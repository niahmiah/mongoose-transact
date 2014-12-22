'use strict';

var mongoose = require('mongoose');
var safemode = {safe: true};
var removeOpt = {remove:true};
var updateOpt = {upsert:false};

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
    if(change.data._id) { delete change.data._id; }
    doc.$set = change.data;
  }
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

function createRevertedUpdateReq(change){
  var q = {_id: change.docId};
  var doc = {};
  if(change.prev) {
    //if(change.prev._id) { delete change.prev._id; }
    doc = change.prev;
  }
  return {q: q, doc: doc};
}

//collection.insert(docs, options, [callback]);
//collection.findAndModify(query, sort, update, options, callback)

var actions = {
  findOne: function(change, callback){
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    coll.findOne({_id: change.docId}, callback);
  },
  insert: function(tx, change, handler, callback){
    var msg = 'success';
    var state = 'done';
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
    var msg = 'success';
    var state = 'done';
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    coll.remove({_id: change.docId},safemode,function(err, result){
      if(err){
        msg = err.message;
        state = 'error';
      }
      if(!result){
        msg = 'could not find document to remove';
        state = 'error';
      }
      handler(tx, change, msg, state, callback);
    });
  },
  update: function(tx, change, handler, callback){
    var msg = 'success';
    var state = 'done';
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    var req = createUpdateReq(change);
    coll.findAndModify(req.q,null,req.doc,updateOpt,function(err){
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
    var msg = 'success';
    var state = 'done';
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    coll.findAndModify({_id: change.docId},null,null,removeOpt,function(err){
      if(err){
        msg = err.message;
        state = 'cancelerror';
      }
      handler(tx, change, msg, state, callback);
    });
  },
  revertUpdate: function(tx, change, handler, callback){
    var msg = 'success';
    var state = 'done';
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    var req = createRevertedUpdateReq(change);
    coll.findAndModify(req.q,null,req.doc,updateOpt,function(err){
      if(err){
        msg = err.message;
        state = 'cancelerror';
      }
      handler(tx, change, msg, state, callback);
    });
  },
  revertUpsert: function(tx, change, handler, callback){
    // not currently used
    handler(tx, change, msg, state, callback);
  },
  revertRemove: function(tx, change, handler, callback){
    var msg = 'success';
    var state = 'done';
    var db = getDBConnection();
    var coll = db.collection(change.coll);
    var doc = change.prev;
    coll.insert(doc, safemode, function(err){
      if (err && err.message && err.message.indexOf('E11000 ') !== -1) {
        // this _id was already inserted in the database
        msg = 'document already exists';
        state = 'cancelerror';
        handler(tx, change, msg, state, callback);
      }else if(err) {
        msg = err.message;
        state = 'cancelerror';
        handler(tx, change, msg, state, callback);
      }else{
        handler(tx, change, msg, state, callback);
      }
    });
  }
};

module.exports = actions;