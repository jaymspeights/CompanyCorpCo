var GOOGLE_API_KEY = 'AIzaSyC8Bkp_SWIgz2PRCyURtEXiXtZ2v9KcplQ';

var request = require('request');
var express = require('express');
var router = express.Router();

router.get('/req/reps/:lat/:lon', function(req, res) {
  var lat = req.params.lat;
  var lon = req.params.lon;
  var uri = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`;
  request(uri, function (err, response, body) {
    if (err) {
      res.render('error', {message: 'Oops! Something went wrong...', error: err});
      return;
    }
		body = JSON.parse(body);
    var addresses = body.results;

    getReps(addresses, function (error, sens, reps) {
      if (error) {
        res.render('error', {message: 'Oops! Something went wrong...', error: err});
        return;
      }
      console.log(sens);
      console.log(reps);
      res.render('landing', {'sens': sens, 'reps':reps});
    });
  });

});

function getReps(addresses, cb) {
  if (addresses.length == 0) {
    cb({status:"We couldn't seem to find you.", stack: "Try entering the address in manually."});
    return;
  }
  var address = addresses.shift().formatted_address;
  address = encodeURIComponent(address);
  var uri = `https://www.googleapis.com/civicinfo/v2/representatives?address=${address}&roles=legislatorLowerBody&roles=legislatorUpperBody&includeOffices=true&key=${GOOGLE_API_KEY}`;
  request(uri, function (err, response, body) {
    if (err) {
      getReps(addresses, cb);
      return;
    }
    body = JSON.parse(body);
    if (body.error) {
      getReps(addresses, cb);
      return;
    }
    var reps = [];
    var sens = [];
    var sens_i;
    var reps_i;
    for (var office of body.offices) {
      if (office.name.match(/United States Senate.*/)) {
        sens_i = office.officialIndices;
      } else if (office.name.match(/United States House of Representatives.*/)) {
        reps_i = office.officialIndices;
      }
    }
    for (var i of sens_i) {
      sens.push(body.officials[i]);
    }
    for (var i of reps_i) {
      reps.push(body.officials[i]);
    }
    cb(undefined, sens, reps);
  });
}

module.exports = router;
