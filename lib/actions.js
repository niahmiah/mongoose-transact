'use strict';

var mongoose = require('mongoose');
var safemode = {safe: true};
var remove = {remove:true};
var update = {upsert:false};
var msg = 'success';
var state = 'done';

function getDBConnection(){
  var conn = mongoose.connection;
  if(!conn.db){ throw new Error('Not connected to the database'); }
  return conn.db;
}

function createInsertDoc(change){
  change.data._id = change.docId; // this makes sure it's an objectId
  return change.data;
}

function createUpdateReq(change){
  var q = {_id: change.docId};
  var doc = {};
  if(change.data) {
    doc.$set = change.data;
  }
  if(doc._id) { delete doc._id; }
  if(change.inc) { doc.$inc = change.inc; }
  if(change.push) {
    var pushObj = {};
    pushObj[change.push.to] = change.push.data;
    doc.$push = pushObj;
    if(change.push.v) {
      q.__v = change.push.v;
    }
  }
  if(change.pull) {
    var pullObj = {};
    pullObj[change.pull.from] = change.pull.data;
    doc.$pull = pullObj;
    if(change.pull.v) {
      q.__v = change.pull.v;
    }
  }
  return {q: q, doc: doc};
}

//collection.insert(docs, options, [callback]);
//collection.findAndModify(query, sort, update, options, callback)

var actions = {
  insert: function(tx, change, handler, callback){
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    var doc = createInsertDoc(change);
    coll.insert(doc, safemode, function(err){
      if (err && err.message && err.message.indexOf('E11000 ') !== -1) {
        // this _id was already inserted in the database
        msg = 'document already exists';
        state = 'error';
        handler(tx, change, msg, state, callback);
      }else if(err) {
        msg = err.message;
        state = 'error';
        handler(tx, change, msg, state, callback);
      }else{
        handler(tx, change, msg, state, callback);
      }
    });
  },
  remove: function(tx, change, handler, callback){
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    coll.findAndModify({_id: change.docId},null,null,remove,function(err){
      if(err){
        msg = err.message;
        state = 'error';
      }
      handler(tx, change, msg, state, callback);
    });
  },
  update: function(tx, change, handler, callback){
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    var req = createUpdateReq(change);
    coll.findAndModify(req.q,null,req.doc,update,function(err){
      if(err){
        msg = err.message;
        state = 'error';
      }
      handler(tx, change, msg, state, callback);
    });
  },
  upsert: function(tx, change, handler, callback){
    //not used currently
    handler(tx, change, msg, state, callback);
  },
  revertInsert: function(tx, change, handler, callback){
    //not used currently
    handler(tx, change, msg, state, callback);
  },
  revertUpdate: function(tx, change, handler, callback){
    //not used currently
    handler(tx, change, msg, state, callback);
  },
  revertUpsert: function(tx, change, handler, callback){
    //not used currently
    handler(tx, change, msg, state, callback);
  },
  revertRemove: function(tx, change, handler, callback){
    //not used currently
    handler(tx, change, msg, state, callback);
  },
};

module.exports = actions;