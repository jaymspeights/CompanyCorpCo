
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;

var request = require('request');
var express = require('express');
var db;
var router = express.Router();
var GOOGLE_API_KEY = fs.readFileSync('./google_api_key', 'utf8').replace('\n', '');
var uri = fs.readFileSync('./db_uri', 'utf8').replace('\n', '');
MongoClient.connect(uri, function (err, _db) {
  if (err) {
    console.log(err);
    throw new Error("Ya fucked up");
  }
  db = _db.db('KYR');
});

function getUserById (id, cb) {
  db.collection('users').findOne({'_id':id}, function (err, user) {
    if (err) throw err;
    cb(user)
  });
}


router.get('/req/id', function (req, res) {
  db.collection('users').count({}, function (err, id) {
    if (err) throw err;
    db.collection('users').insertOne({'_id': id}, function (err, response) {
      if (err) throw err;
      res.send({'id':id});
    });
  });

});

router.get('/req/verify/id', function (req, res) {
  var id = parseInt(req.query.id);
  getUserById(id, function (user) {
    res.send(user!=null?"1":"0");
  });
});

router.get('/req/votes/new', function (req, res) {
  var id = parseInt(req.query.id);
  getUserById(id, function (user) {
    db.collection('votes').find({}).toArray(function(err, votes) {
      if (err) throw err;
      for (var v of votes) {
        var is_in = false;
        if (user.votes!=null)
          for (var uv of user.votes) {
            if (uv._id == v._id) {
              is_in = true;
              break;
            }
          }
        if (!is_in) {
          res.render('vote', v);
          return;
        }
      }
      res.send("Looks like you've seen every vote.");
    });
  });
})

router.get('/req/votes/cast', function (req, res) {
  var vote_id = req.query.vote_id;
  var id = parseInt(req.query.id);
  var vote = req.query.vote;
  getUserById(id, function (user) {
    if (user == null) {
      res.send("How did you even get here without a valid id?");
      return;
    }
    var vote_data = {'_id':vote_id, 'vote':vote};

    if (user.votes==null)
      user.votes = [vote_data];
    else
      for (var i = 0; i < user.votes.length; i++) {
        if (user.votes[i]._id == vote_id) {
          user.votes[i] = vote_data;
          break;
        }
        if (i == user.votes.length-1)
          user.votes.push(vote_data);
      }
    db.collection('users').updateOne({"_id":user._id}, {"$set":user}, {"upsert":true}, function (err, response) {
      if (err) throw err;
      db.collection('votes').find({}).toArray(function(err, votes) {
        if (err) throw err;
        for (var v of votes) {
          var is_in = false;
          if (user.votes!=null)
            for (var uv of user.votes) {
              if (uv._id == v._id) {
                is_in = true;
                break;
              }
            }
          if (!is_in) {
            res.render('vote', v);
            return;
          }
        }
        res.send("Looks like you've seen every vote.");
      });
    });
  });
});

router.get('/req/reps', function(req, res) {
  var id = parseInt(req.query.id);
  getUserById(id, function (user) {
    if (user == null) {
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
        user.loc = loc;
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
    } else {
      getRepsFromDb(user, function(sens, reps) {
        res.render('landing', {'sens': sens, 'reps':reps});

      });
    }
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

    user.senators = [];
    for (var i of sens_i) {
      sens.push(body.officials[i]);
      user.senators.push(body.officials[i].name);
    }
    user.representatives = [];
    for (var i of reps_i) {
      reps.push(body.officials[i]);
      user.representatives.push(body.officials[i].name);
    }

    db.collection('users').updateOne({"_id":user._id}, {"$set":user}, {"upsert":true}, function (err, res) {
      if (err) throw err;
      getRepsFromDb(user, function (sens, reps) {
        cb(undefined, sens, reps);
      });
    });
  });
}

function getRepsFromDb(user, cb) {
  db.collection('senators').find({'name':{'$in' : user.senators}}).toArray(function (err, sens) {
    if (err) throw err;
    db.collection('representatives').find({'name':{'$in' : user.representatives}}).toArray(function (err, reps) {
      if (err) throw err;
      cb(sens, reps);
    });
  });
}

module.exports = router;
