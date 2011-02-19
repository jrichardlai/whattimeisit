/* Author:

*/
var g = new navigator.GeolocationRequest();
var infoWindow = new google.maps.InfoWindow();
var geocoder = new google.maps.Geocoder();
var map;
var markersArray = [];
var locationsArray = new Object();

// create Date object for current location
d = new Date();
var current_time      = d.getTime();
var current_offset    = -d.getTimezoneOffset() / 60;
var time_difference   = 0;
var date_format       = 'yyyy-MM-dd HH:mm';

LocationRow = $.klass({
  initialize: function(marker){
    var self                = this;
    this.marker             = marker;
    this.id                 = $(this.element).attr('id');
    this.name               = marker.title;
    this.marker.item_row    = self;
    this.is_reference       = false;
    locationsArray[this.id] = this;
  },
  updateTime: function(){
    this.time = time_difference + (3600000 * (this.offset - current_offset)) + current_time;
    var text_date = formatDate(new Date(this.time), date_format)
    $('.time input', this.element).val(text_date).data('old-value', text_date);
    log(this.info_window_content);
    $('.time', this.info_window_content).html(text_date);
  },
  setName: function(name){
    this.name = name;
    $('.name input', this.element).val(name);
    $('.name', this.info_window_content).html(name);
  },
  updateContent: function(){
    this.offset = parseInt(this.marker.timezone.rawOffset);

    $('.name input', this.element).val(this.name);
    $('.address', this.element).text(this.marker.address.city + ', ' + this.marker.address.country);
    $('.timezone', this.element).text(this.marker.timezone.timezoneId);

    $(this.element).css('display', '');

    this.updateTime();
  },
  setAsReference: function(){
    this.is_reference = true;
    current_time      = this.time;
    current_offset    = this.offset;
  },
  delete: function(){
    $(this.element).remove();
    this.marker.setMap(null);
    delete locationsArray[this.id];
  }
});

$(document).ready(function(){

  g.request( function(geolocation){
    var myLatlng = new google.maps.LatLng(geolocation.latitude, geolocation.longitude);
    var myOptions = {
      zoom: 2,
      center: myLatlng,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    }
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    google.maps.event.addListener(map, "rightclick", function(event) {
      displayMenu(map, event);
    });

    if ($.cookie('map-locations')) {
      loadLocations(JSON.parse($.cookie('map-locations')));
    }
    else {
      var current_user_point  = new google.maps.LatLng(geolocation.latitude, geolocation.longitude);
      var current_user_marker = createUserMarker(map, current_user_point, "Me");
    }
  })

  $('.time input').live('change', function(){
    //TODO Verify that the date is valid
    time_difference = time_difference + getDateFromFormat($(this).val(), date_format) - getDateFromFormat($(this).data('old-value'), date_format);
    log({time_difference: time_difference, 'real-time': $(this).attr('real-time'), current_time: current_time, val: $(this).val()});
    $.each(locationsArray, function(index, element){
      element.updateTime();
    })
  });

  $('.name input').live('change', function(){
    locationsArray[$(this).parents('.location').first().attr('id')].setName($(this).val());
  });

  $('a.delete').live('click', function(){
    locationsArray[$(this).parents('.location').first().attr('id')].delete();
  });

  $('#save_locations').click(function(){
    cookie_locations_array = []
    $.each(locationsArray, function(index, element) {
      cookie_locations_array.push({lng: element.marker.getPosition().lng(), lat: element.marker.getPosition().lat(), name: element.name})
    });
    cookie_value = JSON.stringify(cookie_locations_array);
    $.cookie('map-locations', cookie_value);
  });
});

function loadLocations(cookie_locations_array) {
  log(cookie_locations_array);
  $.each(cookie_locations_array, function(index, element) {
    if (element.lat && element.lng) {
      var location_point  = new google.maps.LatLng(element.lat, element.lng);
      var location_marker = createUserMarker(map, location_point, element.name || "Unknown");
    }
  });
}

function getTimeZoneRequestUrl(marker) {
  return 'http://query.yahooapis.com/v1/public/yql?' +
  'q=select%20*%20from%20xml%20where%20url%3D"http%3A%2F%2Fws.geonames.org%2Ftimezone%3Flat%3D' +
  marker.getPosition().lat() +'%26lng%3D' +
  marker.getPosition().lng() + '"&format=json';
}

function getCountryCity(result) {
  address = new Object();
  for ( i = 0; i < result.address_components.length; i++){
    for (j = 0; j < result.address_components[i].types.length; j++){
      switch (result.address_components[i].types[j]) {
        case "country":
        address.country = result.address_components[i].long_name
        break;
        case "locality":
        address.city = result.address_components[i].long_name
        break;
      }
    }
  }
  return address;
}

function createItemInList(marker) {
  var item = $('#location-template').clone().
              attr('id', "marker-"+ marker.__gm_id).
              css('display', 'none');

  //Attach the class LocationRow
  $(item).attach(LocationRow, marker);
  $('#locations tbody').append(item);
}

function updateInfoWindowContent(marker, info_window) {
  geocoder.geocode( { 'latLng': marker.getPosition() }, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      var address = getCountryCity(results[0]);
      marker.address = address;
      $.getJSON(getTimeZoneRequestUrl(marker), function(response){
        marker.timezone = response.query.results.geonames.timezone;
        info_window_content = $('<div><span class="name">' + marker.title + '</span> @ ' + address.city + ", " + address.country +
        '<br/> Timezone : ' + marker.timezone.timezoneId +
        '<br/> Local Time : <span class="time">' + marker.timezone.time + '</span></div>');
        info_window.setContent(info_window_content.get(0));
        info_window.open(map, marker);
        marker.item_row.info_window_content = info_window_content;
        marker.item_row.updateContent();
      })
    } else {
      log("Geocode was not successful for the following reason: " + status);
    }
  });
}

function attachInfoWindow(marker) {
  var info_window = new google.maps.InfoWindow();
  google.maps.event.addListener(marker, 'click', function() {
    info_window.open(map, marker);
  });
  google.maps.event.addListener(marker, "dragstart", function() {
    info_window.close(map, marker);
  });
  google.maps.event.addListener(marker, "dragend", function() {
    updateInfoWindowContent(marker, info_window);
  });
  return info_window;
}

function createUserMarker(map, point, name) {
  // Create a lettered icon for this point using our icon class
  marker = new google.maps.Marker({ draggable: true,
                                    map: map,
                                    position: point,
                                    icon: "http://google-maps-icons.googlecode.com/files/waterfall.png",
                                    title: name
                                   });
  createItemInList(marker);
  info_window = attachInfoWindow(marker);
  updateInfoWindowContent(marker, info_window);

  markersArray.push(marker);
  return marker;
}

// Shows any overlays currently in the array
function showOverlays() {
  if (markersArray) {
    for (i in markersArray) {
      markersArray[i].setMap(map);
    }
  }
}

function displayMenu(map, event){
  createUserMarker(map, event.latLng, 'New');
}
