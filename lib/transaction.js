'use strict';

/* The purpose of this schema is to allow you to modify 2 documents in
a collection, or roll back, creating a psuedo transaction system */

var mongoose          = require('mongoose');
var Schema            = mongoose.Schema;
var ObjectId          = mongoose.Schema.Types.ObjectId;
var Mixed             = mongoose.Schema.Types.Mixed;

var async             = require('async');
var validator         = require('./validator');
var actions           = require('./actions');

var states = ['new', 'started', 'cancelling', 'cancelled', 'error', 'done'];

var getNewCopy = {
  new: true, //return new version of doc 
  upsert: false //do not insert if it doesnt exist
};

var Transaction = new Schema({
  app: {type: String, required: true}, //the originator of this request
  created: { type: Date, default: Date.now }, 
  lastModified: { type: Date, default: Date.now }, 
  state: {type: String, enum: states, default: states[0]},
  changes: {type: [Change], required: true}
});

var Change = new Schema({
  coll: {type: String}, //name of collection
  docId: {type: ObjectId}, //document to modify
  act: {
    type: String, 
    enum: ['insert', 'update', 'upsert', 'remove'], 
    required: true
  },
  prev: Mixed, //copy of previous state for rollback
  inc: Mixed, //object for incrementing multiple fields
  data: Mixed, //object containing all fields that need to be set
  push: {
    to: String, //field name of array to push data into
    data: Mixed,
    v: Number //optionally limit this to a document version
  },
  pull: {
    from: String,
    data: Mixed, 
    v: Number
  },
  state: {type: String},
  msg: String // any error or state messages
});

//do not allow multiple changes to be requested for the same document 
Transaction.index({'changes.docId':1}, {unique: true});

//validate change requests
Transaction.pre('save', validator);

Transaction.statics.create = function(tx, timeout, callback){
  if(typeof timeout === 'function'){
    callback = timeout; //allow skipping of timeout
    timeout = 5 * 1e3;
  }
  tx = new Transaction(tx);
  tx.save(function(err){
    if(err && err.message && err.message.indexOf('E11000 ') !== -1) {

    }else if(err){
      throw err;
    }else{
      callback(null,tx);
    }
  });
}

Transaction.methods.start = function(app, callback){
  var self = this;
  Transaction.findOneAndUpdate(
    {
      _id: self._id, 
      state: states[0],
      __v: self.__v, //make sure version hasnt changed
    }, 
    {
      app: app, 
      state: states[1], 
      lastModified: Date.now(), 
      $inc: {__v: 1}
    }, 
    getNewCopy, 
    function(err,doc){
      if(err){ throw err; }
      if(!doc){ 
        var errMsg = 'Transaction cannot start: '+self._id;
        callback(new Error(errMsg));
      }else{
        doc.startChanges(callback);
      }
    }
  );
};

Transaction.methods.startChanges = function(callback){
  var self = this;
  //todo: self is old copy. auto populate prev
  async.eachSeries(
    self.changes,
    function(change, callback){
      self.startChange(self, change, callback);
    },
    function(err){
      if(err) { self.revert(err, callback); }
      else { self.finish(callback); }
    }
  );
};

Transaction.methods.startChange = function(self, change, callback){
  //had to pass 'self' in manually
    Transaction.findOneAndUpdate(
      {
        _id: self._id, 
        'changes.docId': change.docId,
        'changes.state': 'new'
      },
      {
        $set: {'changes.$.state': 'started'}, 
        lastModified: Date.now(), 
        $inc: {__v: 1}
      },
      getNewCopy,
      function(err, doc){
        if(err){ throw err; }
        if(!doc){
          var errMsg = 'Transaction change cant be started in: '+self._id;
          callback(new Error(errMsg));
        }else{
          change.state = 'started';
          doc.doChange(change, callback);
        }
      }
    );
};

Transaction.methods.doChange = function(change, callback){
  var self = this;
  var handler = self.handleChangeResult;
  if(change.act === 'insert') { 
    self.doInsert(self, change, handler, callback); 
  }
  else if(change.act === 'update') { 
    self.doUpdate(self, change, handler, callback); 
  }
  else if(change.act === 'upsert') { 
    self.doUpsert(self, change, handler, callback); 
  }
  else if(change.act === 'remove') { 
    self.doRemove(self, change, handler, callback); 
  }
  else{
    var errMsg = 'Transaction change includes invalid action: '+self._id;
    handler(self, change, errMsg, 'error', callback);
  }
};

Transaction.methods.handleChangeResult = function(tx, change, msg, state, cb){
  var self = tx;
  Transaction.findOneAndUpdate(
    {
      _id: self._id, 
      __v: self.__v, //make sure version hasnt changed
      'changes.docId': change.docId
    },
    {
      $set: {
        'changes.$.state': state,
        'changes.$.msg': msg,
      }, 
      lastModified: Date.now(), 
      $inc: {__v: 1}
    },
    getNewCopy,
    function(err, doc){
      if(err){ throw err; }
      if(!doc){
        var errMsg = 'Transaction change cant be updated in: '+self._id;
        cb(new Error(errMsg));
      }else{
        if(state === 'error'){
          cb(new Error(change.coll +': '+ change.docId +': '+ msg));
        }else{
          cb();
        }
      }
    }
  );
};

Transaction.methods.finish = function(callback){
  var self = this;
  var badChangeStates = [];
  states.forEach(function(state){
    badChangeStates.push({'changes.state': state});
  });
  badChangeStates.pop(); // last state is success, not bad
  Transaction.findOneAndRemove(
    {
      _id: self._id, 
      state: states[1],
      $nor: badChangeStates
    },
    function(err, doc){
      if(err){ throw err; }
      if(!doc){
        var errMsg = 'Transaction cannot finish in current state: '+self._id;
        callback(new Error(errMsg));
      }else{
        callback();
      }
    }
  );
};

Transaction.methods.revert = function(err, callback){
  callback(err);
};

Transaction.methods.doInsert = actions.insert;

Transaction.methods.doUpdate = actions.update;

Transaction.methods.doUpsert = actions.upsert;

Transaction.methods.doRemove = actions.remove;

Transaction.methods.revertInsert = actions.revertInsert;

Transaction.methods.revertUpdate = actions.revertUpdate;

Transaction.methods.revertUpsert = actions.revertUpsert;

Transaction.methods.revertRemove = actions.revertRemove;

module.exports = Transaction = mongoose.model('Transaction', Transaction);