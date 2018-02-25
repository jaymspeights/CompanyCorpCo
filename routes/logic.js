var GOOGLE_API_KEY = 'AIzaSyC8Bkp_SWIgz2PRCyURtEXiXtZ2v9KcplQ';

var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;

var request = require('request');
var express = require('express');
var db;
var router = express.Router();

var uri = fs.readFileSync('./db_uri', 'utf8').replace('\n', '');
MongoClient.connect(uri, function (err, _db) {
  if (err) {
    console.log(err);
    throw new Error("Ya fucked up");
  }
  db = _db.db('KYR');
});

var current_user_id;
function getCurrentUserId() {
  getNewId((id) => {
    current_user_id = id;
  });
}

function getNewId(cb) {
  db.collection('users').count(function (err, count) {
    if (err) {
      console.log(err);
      throw new Error(err);
    }
    cb(count)
  });
}

function getMostRecentBill(cb) {
  cb();
}

function getUserById (id, cb) {
  db.collection('users').findOne({'_id':id}, function (err, user) {
    if (err)
      throw err;
    cb(user)
  });
}


router.get('/req/id', function (req, res) {
  current_user_id += 1;
  db.collection('users').insertOne({'_id': current_user_id}, function (err, response) {
    if (err)
      throw err;
    res.send({id:current_user_id});
  });
});

router.get('/req/bills/new', function (req, res) {
  getMostRecentBill(function (err, data) {
    if (error) {
      res.render('error', {message: 'Oops! Something went wrong...', error: err});
      return;
    }

  });
})

router.get('/req/reps', function(req, res) {
  var id = req.query.id;
  getUserById(id, function (user) {
    console.log(user)
    if (user == undefined) {
      res.render('error', {message: 'Oops! Something went wrong...', error: {status:"You don't have a user id yet.", stack: "Stop fucking around with our api."}});
      return;
    } else if (user.senators == undefined || user.representatives == undefined) {
      var loc = req.query.latlng;
      var uri = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc}&key=${GOOGLE_API_KEY}`;
      request(uri, function (err, response, body) {
        if (err) {
          res.render('error', {message: 'Oops! Something went wrong...', error: err});
          return;
        }
    		body = JSON.parse(body);
        var addresses = body.results;

        getRepsFromApi(user, addresses, function (error, sens, reps) {
          if (error) {
            res.render('error', {message: 'Oops! Something went wrong...', error: err});
            return;
          }
          res.render('landing', {'sens': sens, 'reps':reps});
        });
      });
    }
    db.collection('senators').findAll({'id':{'$in' : user.senators}}, function (err, sens) {
      if (err) throw err;
      db.collection('representatives').findAll({'id':{'$in' : user.representatives}}, function (err, reps) {
        if (err) throw err;
        res.render('landing', {'sens': sens, 'reps':reps});
      });
    });
  });
});

function getRepsFromApi(user, addresses, cb) {
  if (addresses.length == 0) {
    cb({status:"We couldn't seem to find you.", stack: "Try entering the address in manually."});
    return;
  }
  var address = addresses.shift().formatted_address;
  address = encodeURIComponent(address);
  var uri = `https://www.googleapis.com/civicinfo/v2/representatives?address=${address}&roles=legislatorLowerBody&roles=legislatorUpperBody&includeOffices=true&key=${GOOGLE_API_KEY}`;
  request(uri, function (err, response, body) {
    if (err) {
      getRepsFromApi(user, addresses, cb);
      return;
    }
    body = JSON.parse(body);
    if (body.error) {
      getRepsFromApi(user, addresses, cb);
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
    //user.senators = [];
    for (var i of sens_i) {
      sens.push(body.officials[i]);
      //user.senators.push(body.officials[i].id);
    }
    //user.representatives = [];
    for (var i of reps_i) {
      reps.push(body.officials[i]);
      //user.representatives.push(body.officials[i].id);
    }
    db.collection('users').updateOne({"_id":user._id}, {"$set":user}, {"upsert":true}, function (err, res) {
      if (err) throw err;
      cb(undefined, sens, reps);
    });
  });
}

module.exports = router;
