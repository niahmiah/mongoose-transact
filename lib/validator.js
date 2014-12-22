'use strict';
var async = require('async');

var states = ['new', 'started', 'cancelling', 'cancelled', 'error', 'done'];

function validator(next){
  var self = this;
  if(!self.changes || self.changes.length === 0){
    var err = 'A transaction without changes is not a transction.';
    return next(new Error(err));
  }
  // if(self.changes && self.changes.length < 2) {
  //   var err = 'A transaction is not needed for less than 2 changes';
  //   return next(new Error(err));
  // }
  async.eachSeries(
    self.changes,
    function(change, callback){
      if(!change.state) { change.state = 'new'; }
      if(states.indexOf(change.state) < 0) {
        err = 'invalid change state';
      }
      var err;
      if(!change.docId) { err = 'change requires docId'; }
      if(!change.coll) { err = 'change requires collection name'; }
      switch(change.act) {
        case 'insert':
          if(!change.data) { err = 'inserts require field "data"'; }
          if(change.data._id && change.docId){
            if(change.data._id.toString() !== change.docId.toString()){
              err = 'insert data _id does not match docId';
            }
          } 
          if(!change.data instanceof Object) { 
            err = 'insert data must be an object'; 
          }
          if(!change.data._id) { 
            err = 'insert data have an objectId'; 
          }
          if(change.prev) { err = 'inserts cannot have a previous document'; }
          if(change.inc) { err = 'inserts cannot increment'; }
          if(change.push) {err = 'inserts cannot push'; }
          if(change.pull) {err = 'inserts cannot pull'; }
          callback(err);
          break;
        case 'update': 
          if(!change.inc && !change.data && !change.push && !change.pull){
            err = 'update requested, with no update fields';
          }
          if(!change.prev) { 
            err = 'updates require a copy of the previous document'; 
          }
          if(change.push){
            if(!change.push.to){
              err = 'push requires a field to push to';
            }
            if(!change.push.data){
              err = 'push requires data';
            }
          } 
          if(change.pull){
            if(!change.pull.from){
              err = 'pull requires a field to pull from';
            }
            if(!change.pull.data){
              err = 'pull requires data';
            }
          }
          if(change.push && change.pull){
            if(change.push.v && change.pull.v){
              if(change.push.v !== change.pull.v){
                err = 'push and pull have different doc versions';
              }
            }
          }
          callback(err);
          break;
        case 'upsert':
          err = 'upsert currently not implemented';
          callback(err);
          break;
        case 'remove':
          if(!change.prev) { 
            err = 'remove requires copy of the current document';
          }
          if(change.inc) { err = 'remove cannot increment'; }
          if(change.push) {err = 'remove cannot push'; }
          if(change.pull) {err = 'remove cannot pull'; }
          if(change.data) {err = 'remove doesnt need data object'; }
          callback(err);
          break;
        default: 
          err = 'invalid change request';
          callback(err);
      }
    },
    function(err){
      if(err) { self.invalidate('changes', err); }
      if(err) { err = new Error(err); }
      next(err);
    }
  );
}

module.exports = validator;