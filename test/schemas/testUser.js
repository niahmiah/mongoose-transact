'use strict';

/* The purpose of this schema is to allow you to modify 2 documents in
a collection, or roll back, creating a psuedo transaction system */

var mongoose          = require('mongoose');
var Schema            = mongoose.Schema;
var ObjectId          = mongoose.Schema.Types.ObjectId;
var Mixed             = mongoose.Schema.Types.Mixed;

var testUser = new Schema({
  name: String,
  phone: String,
  tags: Array,
  num: Number
});

module.exports = testUser = mongoose.model('testUser', testUser);