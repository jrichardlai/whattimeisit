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

//Use of the plugin lowpro.jquery.js
LocationRow = $.klass({
  initialize: function(marker, info_window, config){
    config                  = config || {};
    var self                = this;
    this.info_window        = info_window;
    this.marker             = marker;
    this.id                 = $(this.element).attr('id');
    this.name               = config.name || marker.title;
    this.color              = config.color || '#'+(Math.random()*0xFFFFFF<<0).toString(16);
    this.marker.item_row    = self;
    this.is_reference       = false;
    locationsArray[this.id] = this;
    $('.color-picker div', self.element).css('background-color', this.color);
    $('.color-picker', this.element).ColorPicker({
      color: self.color,
      onShow: function (colpkr) {
        $(colpkr).fadeIn(500);
        return false;
      },
      onHide: function (colpkr) {
        $(colpkr).fadeOut(500);
        return false;
      },
      onChange: function (hsb, hex, rgb) {
        $('.color-picker div', self.element).css('background-color', '#' + hex);
        self.setColor('#' + hex);
      }
    });

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
  setColor: function(color){
    if (color) this.color = color;
    $('.name input', this.element).css('color', color || this.color);
    $('.name', this.info_window_content).css('color', color || this.color);
  },
  updateContent: function(){
    this.offset = parseInt(this.marker.timezone.rawOffset);

    $('.name input', this.element).val(this.name);
    $('.address input', this.element).val(this.marker.address.city + ', ' + this.marker.address.country);
    $('.timezone', this.element).text(this.marker.timezone.timezoneId);

    $(this.element).css('display', '');

    //Show the header of the table
    $('table#locations thead').show();

    this.updateTime();
  },
  updateAddress: function(address){
    updateInfoWindowContent(this.marker, this.info_window, address);
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

  //Get the current geolocalisation
  g.request( function(geolocation){
    var myLatlng = new google.maps.LatLng(geolocation.latitude, geolocation.longitude);
    var myOptions = {
      zoom: 2,
      center: myLatlng,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    }
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    google.maps.event.addListener(map, "rightclick", function(event) {
      createUserMarker(map, event.latLng, {name: 'New'});
    });

    if ($.cookie('map-locations')) {
      loadLocations(JSON.parse($.cookie('map-locations')));
    }
    else {
      var current_user_point  = new google.maps.LatLng(geolocation.latitude, geolocation.longitude);
      var current_user_marker = createUserMarker(map, current_user_point, {name: "Me"});
    }
  })

  // Button to save the locations in the cookies
  $('#save_locations').click(function(){
    cookie_locations_array = []
    $.each(locationsArray, function(index, element) {
      cookie_locations_array.push({ lng: element.marker.getPosition().lng(),
                                    lat: element.marker.getPosition().lat(),
                                    color: element.color,
                                    name: element.name})
    });
    cookie_value = JSON.stringify(cookie_locations_array);
    $.cookie('map-locations', cookie_value);
  });

  // Live events mapping
  $('.time input').live('change', function(){
    //TODO Verify that the date is valid

    time_difference = time_difference + getDateFromFormat($(this).val(), date_format) - getDateFromFormat($(this).data('old-value'), date_format);
    log({time_difference: time_difference, 'real-time': $(this).attr('real-time'), current_time: current_time, val: $(this).val()});
    $.each(locationsArray, function(index, element){
      element.updateTime();
    })
  });

  // Add live event for the input name
  $('.name input').live('change', function(){
    locationsArray[$(this).parents('.location').first().attr('id')].setName($(this).val());
  });

  // Add live event for the input address
  $('.address input').live('change', function(){
    locationsArray[$(this).parents('.location').first().attr('id')].updateAddress($(this).val());
  });

  $('a.delete').live('click', function(){
    locationsArray[$(this).parents('.location').first().attr('id')].delete();
  });

});

function loadLocations(cookie_locations_array) {
  log(cookie_locations_array);
  $.each(cookie_locations_array, function(index, element) {
    if (element.lat && element.lng) {
      var location_point  = new google.maps.LatLng(element.lat, element.lng);
      var location_marker = createUserMarker(map, location_point, element);
    }
  });
}

// Get the time zone from a marker using the yahooapis
function getTimeZoneRequestUrl(marker) {
  return 'http://query.yahooapis.com/v1/public/yql?' +
  'q=select%20*%20from%20xml%20where%20url%3D"http%3A%2F%2Fws.geonames.org%2Ftimezone%3Flat%3D' +
  marker.getPosition().lat() +'%26lng%3D' +
  marker.getPosition().lng() + '"&format=json';
}

// Get the country and the city from a result of google geocoder
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

function createLocationRow(marker, info_window, config) {
  var item = $('#location-template').clone().
              attr('id', "marker-"+ marker.__gm_id).
              css('display', 'none');

  //Attach the class LocationRow
  $(item).attach(LocationRow, marker, info_window, config);
  $('#locations tbody').append(item);
}

function updateInfoWindowContent(marker, info_window, address) {
  if (address)
    geocode_options = { 'address': address }
  else
    geocode_options = { 'latLng': marker.getPosition() }
  geocoder.geocode(geocode_options, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      var address = getCountryCity(results[0]);
      marker.setPosition(results[0].geometry.location);
      marker.address = address;
      // Get the timezone values
      $.getJSON(getTimeZoneRequestUrl(marker), function(response){
        if (response.query.results) {
          marker.timezone = response.query.results.geonames.timezone;
          info_window_content = $('<div class="info-content"><span class="name">' + marker.item_row.name + '</span> @ ' +
          '<span class="address">' + address.city + ", " + address.country + '</span>' +
          '<br/> Timezone : ' + marker.timezone.timezoneId +
          '<br/> Local Time : <span class="time">' + marker.timezone.time + '</span></div>');
          info_window.setContent(info_window_content.get(0));
          info_window.open(map, marker);
          marker.item_row.info_window_content = info_window_content;
          marker.item_row.updateContent();
          marker.item_row.setColor();
        }
      })
    } else {
      log("Geocode was not successful for the following reason: " + status);
    }
  });
}

// Attach the info window to a marker
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

// Create the user marker on the map for a location, passing a name as a param
function createUserMarker(map, point, config) {
  // Create a lettered icon for this point using our icon class
  marker = new google.maps.Marker({ draggable: true,
                                    map: map,
                                    position: point,
                                    icon: "http://google-maps-icons.googlecode.com/files/world.png",
                                    title: config.name
                                   });
  info_window = attachInfoWindow(marker);
  createLocationRow(marker, info_window, config);
  updateInfoWindowContent(marker, info_window);

  markersArray.push(marker);
  return marker;
}
