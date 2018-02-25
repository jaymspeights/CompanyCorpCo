var GOOGLE_API_KEY = 'AIzaSyC8Bkp_SWIgz2PRCyURtEXiXtZ2v9KcplQ';

var request = require('request');
var express = require('express');
var router = express.Router();

router.get('/reps/:lat/:lon', function(req, res) {
  var lat = req.query.lat;
  var lon = req.query.lon;
  var uri = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`;
  request(uri, function (err, res, body) {
    if (err) {
      res.render('error', {message: 'Oops! Something went wrong...', error: err});
      return;
    }
    var address = body.results.formatted_address;
    var uri = `https://www.googleapis.com/civicinfo/v2/representatives?address=${address}&roles=legislatorLowerBody&roles=legislatorUpperBody&includeOffices=true&key=${GOOGLE_API_KEY}`;
    request(uri, function (err, res, body) {
      if (err) {
        res.render('error', {message: 'Oops! Something went wrong...', error: err});
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
      for (var i of rep_i) {
        reps.push(body.officials[i]);
      }
      res.send({'sens': sens, 'reps':reps});
    });
  });

});

module.exports = router;
