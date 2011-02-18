/* Author:

*/
var g = new navigator.GeolocationRequest();
var infoWindow = new google.maps.InfoWindow();
var geocoder = new google.maps.Geocoder();
var map;
var markersArray = [];

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

    var current_user_point  = new google.maps.LatLng(geolocation.latitude, geolocation.longitude);
    var current_user_marker = createUserMarker(map, current_user_point, "Me");
  })
});

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

function updateItemInList(marker){
  item = marker.itemInList;
  $('.name', item).text(marker.title);
  $('.location input', item).val(marker.address.city + ', ' + marker.address.country);
  $('.timezone', item).text(marker.timezone.timezoneId);
  $('.time input', item).val(marker.timezone.time);
  $(item).css('display', '');
}
function createItemInList(marker) {
  var item = $('#people-template').clone();
  $(item).attr('id', "marker-"+ marker.__gm_id);
  $(item).css('display', 'none');
  marker.itemInList = item;
  // item.attr('id', "marker-" + marker.id);
  $('#people tbody').append(item);
}

function updateInfoWindowContent(marker, infowindow) {
  geocoder.geocode( { 'latLng': marker.getPosition() }, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      var address = getCountryCity(results[0]);
      marker.address = address;
      $.getJSON(getTimeZoneRequestUrl(marker), function(response){
        marker.timezone = response.query.results.geonames.timezone;
        infowindow.setContent(marker.title + ' @ ' + address.city + ", " + address.country +
        '<br/> Timezone : ' + marker.timezone.timezoneId +
        '<br/> Local Time : ' + marker.timezone.time);
        infowindow.open(map, marker);
        updateItemInList(marker);
      })
    } else {
      log("Geocode was not successful for the following reason: " + status);
    }
  });
}

function attachInfoWindow(marker, name) {
  var infowindow = new google.maps.InfoWindow();
  updateInfoWindowContent(marker, infowindow);

  google.maps.event.addListener(marker, 'click', function() {
    infowindow.open(map, marker);
  });
  google.maps.event.addListener(marker, "dragstart", function() {
    infowindow.close(map, marker);
  });
  google.maps.event.addListener(marker, "dragend", function() {
    updateInfoWindowContent(marker, infowindow);
  });
}

function createUserMarker(map, point, name) {
  // Create a lettered icon for this point using our icon class
  // var userIcon = new Icon(baseIcon);
  // userIcon.image = "http://google-maps-icons.googlecode.com/files/waterfall.png";

  // Set up our GMarkerOptions object
  marker = new google.maps.Marker({ draggable: true,
                                    map: map,
                                    position: point,
                                    icon: "http://google-maps-icons.googlecode.com/files/waterfall.png",
                                    title: name
                                   });
  attachInfoWindow(marker, name);
  createItemInList(marker);
  markersArray.push(marker);
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
  createUserMarker(map, event.latLng, 'toto');
}