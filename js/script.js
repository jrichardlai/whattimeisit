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
var timeout           = null;
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
    $('.time input', this.element).datetimepicker({ timeFormat: 'hh:mm',
                                                    dateFormat: 'yy-mm-dd',
                                                    showButtonPanel: false,
                                                    showTime: false,
                                                    showCalendar: false,
                                                    beforeShow: function(input, inst) {
                                                      inst.dpDiv.css({'margin-top': -input.offsetHeight + 'px', 'margin-left': input.offsetWidth + 'px'});
                                                    }});
    $('.time input', this.element).change(function(){
      //TODO Verify that the date is valid

      time_difference = time_difference + getDateFromFormat($(this).val(), date_format) - getDateFromFormat($(this).data('old-value'), date_format);
      $.each(locationsArray, function(index, element){
        element.updateTime();
      })
    });

    $('.name input', this.element).change(function(){
      self.setName($(this).val());
    });

    $('.address input', this.element).change(function(){
      self.updateAddress($(this).val());
    });

    $('a.delete', this.element).click(function(){
      self.destroy();
    });
  },
  updateTime: function(){
    this.time = time_difference + (3600000 * (this.offset - current_offset)) + current_time;
    var text_date = formatDate(new Date(this.time), date_format)
    $('.time input', this.element).val(text_date).data('old-value', text_date);
    $('.time', this.info_window_content).html(text_date);
  },
  setName: function(name){
    this.name = name;
    $('.name input', this.element).val(name);
    $('.name', this.info_window_content).html(name);
    saveLocations();
  },
  setColor: function(color){
    if (color) this.color = color;
    $('.name input', this.element).css('color', color || this.color);
    $('.name', this.info_window_content).css('color', color || this.color);
    saveLocations();
  },
  updateContent: function(){
    this.offset = parseInt(this.marker.timezone.rawOffset);

    $('.name input', this.element).val(this.name);
    $('.address input', this.element).val(this.marker.address);
    $('.timezone', this.element).text(displayTimezone(this.marker.timezone));

    $(this.element).css('display', '');

    //Show the header of the table
    $('table#locations thead, table#locations tfoot').show();

    this.updateTime();
    saveLocations();
  },
  updateAddress: function(address){
    updateInfoWindowContent(this.marker, this.info_window, {address: address});
    saveLocations();
  },
  setAsReference: function(){
    this.is_reference = true;
    current_time      = this.time;
    current_offset    = this.offset;
  },
  destroy: function(){
    $(this.element).remove();
    this.marker.setMap(null);
    delete locationsArray[this.id];
    saveLocations();
  }
});

Address = $.klass({
  initialize: function(address_components){
    for ( i = 0; i < address_components.length; i++){
      for (j = 0; j < address_components[i].types.length; j++){
        switch (address_components[i].types[j]) {
          case "country":
          this.country = address_components[i].long_name
          break;
          case "locality":
          this.city = address_components[i].long_name
          break;
        }
      }
    }
  },
  toString: function(){
    if (this.city)
    return this.city + ', ' + this.country;
    return this.country;
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
      createUserMarker(map, {'latLng': event.latLng}, {name: 'New'});
    });

    if ($.cookie('map-locations')) {
      loadLocations(JSON.parse($.cookie('map-locations')));
    }
    else {
      var current_user_point  = new google.maps.LatLng(geolocation.latitude, geolocation.longitude);
      var current_user_marker = createUserMarker(map, {'latLng': current_user_point}, {name: "Me"});
    }
  })

  $('#new_location').change(function(event) {
    createUserMarker(map, {'address': $(this).val()}, {name: "New"});
    $(this).val('');
  });

  //Set the checkbox event for the realtime
  $('#realtime').change(function(event) {
    if ($(this).is(':checked')) {
      var d = new Date();
      timeout = setTimeout("addMinute()", 60000 - d.getSeconds() * 1000);
    }
    else
      clearTimeout(timeout);
  });

  //Set the checkbox event for the realtime
  $('#now').click(function(event) {
    for (key in locationsArray) break;
    $('.time input', locationsArray[key].element).val(formatDate(calcTime(locationsArray[key].offset), date_format)).trigger('change');
    $('#realtime').attr('checked', 'checked').trigger('change');
  });

});

// function to calculate local time
// given the city's UTC offset
function calcTime(offset) {
  var d = new Date();
  var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  var nd = new Date(utc + (3600000*offset));
  return nd;
}

function saveLocations() {
  cookie_locations_array = []
  $.each(locationsArray, function(index, element) {
    if (element.marker && element.marker.getPosition())
    cookie_locations_array.push({ lng: element.marker.getPosition().lng(),
                                  lat: element.marker.getPosition().lat(),
                                  color: element.color,
                                  name: element.name})
  });
  cookie_value = JSON.stringify(cookie_locations_array);
  log(cookie_value);
  $.cookie('map-locations', cookie_value, { expires: 30 } );
}

function addMinute() {
  $('.time input').last().val(formatDate(new Date(getDateFromFormat($('.time input').last().val(), date_format) + 60000), date_format)).trigger("change");
  timeout = setTimeout("addMinute()", 60000);
}

function loadLocations(cookie_locations_array) {
  $.each(cookie_locations_array, function(index, element) {
    if (element.lat && element.lng) {
      var location_point  = new google.maps.LatLng(element.lat, element.lng);
      var location_marker = createUserMarker(map, {'latLng': location_point}, element);
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

function createLocationRow(marker, info_window, location_row_config) {
  var item = $('#location-template').clone().
              attr('id', "marker-"+ marker.__gm_id).
              css('display', 'none');

  //Attach the class LocationRow
  $(item).attach(LocationRow, marker, info_window, location_row_config);
  $('#locations tbody').append(item);
}

function updateInfoWindowContent(marker, info_window, geocoder_options) {
  if (!geocoder_options) geocoder_options = {'latLng': marker.getPosition()};
  geocoder.geocode(geocoder_options, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      var address = new Address(results[0].address_components);
      marker.setPosition(results[0].geometry.location);
      marker.address = address;
      // Get the timezone values
      $.getJSON(getTimeZoneRequestUrl(marker), function(response){
        if (response.query.results) {
          marker.timezone = response.query.results.geonames.timezone;
          info_window_content = $('<div class="info-content"><span class="name">' + marker.item_row.name + '</span> @ ' +
          '<span class="address">' + address + '</span>' +
          '<br/> Timezone : ' + displayTimezone(marker.timezone) +
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

function displayTimezone(timezone) {
  offset = parseInt(timezone.rawOffset)
  offset = offset > 0 ? '+' + offset : offset
  return timezone.timezoneId +  ', GMT' + offset
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
function createUserMarker(map, geocoder_options, location_row_config) {
  // Create a lettered icon for this point using our icon class
  marker = new google.maps.Marker({ draggable: true,
                                    map: map,
                                    icon: "http://google-maps-icons.googlecode.com/files/world.png",
                                    title: location_row_config.name
                                   });
  info_window = attachInfoWindow(marker);
  createLocationRow(marker, info_window, location_row_config);
  updateInfoWindowContent(marker, info_window, geocoder_options);
  markersArray.push(marker);
  return marker;
}
