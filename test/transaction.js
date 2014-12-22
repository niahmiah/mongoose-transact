'use strict';

var should = require('chai').should();
var sinon = require('sinon');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');

var Transaction = require('../index');
var TestSchema1 = require('./schemas/test1');
var TestUser = require('./schemas/testUser');

describe('Transaction', function(){

  describe('validators', function(){
    beforeEach(function(done){
      Transaction.remove(function(){
        TestSchema1.remove(function(){
          TestUser.remove(done);
        })
      });
    });

    afterEach(function(done){
      Transaction.remove(function(){
        TestSchema1.remove(function(){
          TestUser.remove(done);
        })
      });
    });

    it('should give a validation error on improperly constructed transactions', 
    function(done){
      var blah = new Transaction({blah: true});
      blah.save(function(err){
        should.exist(err);
        (err.message).should.equal('Validation failed');
        done();
      });
    });

    it('should require at least 2 changes', function(done){
      var testUser1 = new TestUser({name: 'Bob'});

      var tx = new Transaction({
        app: 'mocha',
        changes: [
          {
            coll: 'testusers',
            act: 'insert',
            data: testUser1
          }
        ]
      });
      tx.save(function(err){
        should.exist(err);
        done();
      });
    });

    describe('inserts', function(){
      it('should give an error on improperly constructed inserts', function(done){
        var testUser1 = new TestUser({name: 'Bob'});
        var testUser2 = new TestUser({name: 'Alice'});

        var tx = new Transaction({
          app: 'mocha',
          changes: [
            {
              coll: 'testusers',
              act: 'insert',
              data: testUser1
            },
            {
              coll: 'testusers',
              act: 'insert',
              data: testUser2,
              inc: {blah: 'blah'}
            }
          ]
        });
        tx.save(function(err){
          should.exist(err);
          done();
        });
      });

      it('should not give an error on properly constructed inserts', function(done){
        var testUser1 = new TestUser({name: 'Bob'});
        var testUser2 = new TestUser({name: 'Alice'});

        var tx = new Transaction({
          app: 'mocha',
          changes: [
            {
              coll: 'testusers',
              act: 'insert',
              docId: testUser1._id,
              data: testUser1
            },
            {
              coll: 'testusers',
              act: 'insert',
              docId: testUser2._id,
              data: testUser2
            }
          ]
        });
        tx.save(function(err){
          should.not.exist(err);
          done();
        });
      });
    });

    describe('removes', function(){
      it('should give an error on improperly constructed removes', function(done){
        var testUser1 = new TestUser({name: 'Bob'});
        var testUser2 = new TestUser({name: 'Alice'});

        var tx = new Transaction({
          app: 'mocha',
          changes: [
            {
              coll: 'testusers',
              act: 'remove',
              data: testUser1
            },
            {
              coll: 'testusers',
              act: 'remove',
              data: testUser2,
              inc: {blah: 'blah'}
            }
          ]
        });
        tx.save(function(err){
          should.exist(err);
          done();
        });
      });

      it('should not give an error on properly constructed removes', function(done){
        var testUser1 = new TestUser({name: 'Bob'});
        var testUser2 = new TestUser({name: 'Alice'});

        var tx = new Transaction({
          app: 'mocha',
          changes: [
            {
              coll: 'testusers',
              act: 'remove',
              docId: testUser1._id,
              prev: testUser1
            },
            {
              coll: 'testusers',
              act: 'remove',
              docId: testUser2._id,
              prev: testUser2
            }
          ]
        });
        tx.save(function(err){
          should.not.exist(err);
          done();
        });
      });
    });

    describe('updates', function(){
      it('should give an error on improperly constructed updates', function(done){
        var testUser1 = new TestUser({name: 'Bob'});
        var testUser2 = new TestUser({name: 'Alice'});

        var testDoc1 = new TestSchema1({
          user: testUser1._id,
          balance: 100,
        });
        var testDoc2 = new TestSchema1({
          user: testUser2._id,
          balance: 100,
        });

        var tx = new Transaction({
          app: 'mocha',
          changes: [
            {
              coll: 'test1',
              docId: testDoc1._id,
              act: 'update',
              prev: testDoc1,
            },
            {
              coll: 'test1',
              docId: testDoc2._id,
              act: 'update',
              prev: testDoc2,
              inc: {balance: 5},
              push: {events: 'sale $5'}
            }
          ]
        });
        testUser1.save(function(err){
          should.not.exist(err);
          testUser2.save(function(err){
            should.not.exist(err);
            tx.save(function(err){
              should.exist(err);
              done();
            });
          });
        });
      }); 

      it('should not give an error on properly constructed updates', function(done){
        var testUser1 = new TestUser({name: 'Bob'});
        var testUser2 = new TestUser({name: 'Alice'});

        var testDoc1 = new TestSchema1({
          user: testUser1._id,
          balance: 100,
        });
        var testDoc2 = new TestSchema1({
          user: testUser2._id,
          balance: 100,
        });

        var tx = new Transaction({
          app: 'mocha',
          changes: [
            {
              coll: 'test1',
              docId: testDoc1._id,
              act: 'update',
              prev: testDoc1,
              inc: {balance: -5},
              push: {
                to: 'events',
                data: 'purchase $5'
              }
            },
            {
              coll: 'test1',
              docId: testDoc2._id,
              act: 'update',
              prev: testDoc2,
              inc: {balance: 5},
              push: {
                to: 'events',
                data: 'sale $5'
              }
            }
          ]
        });
        testUser1.save(function(err){
          should.not.exist(err);
          testUser2.save(function(err){
            should.not.exist(err);
            tx.save(function(err){
              should.not.exist(err);
              done();
            });
          });
        });
      }); 
    });
  });

  describe('#start', function(){
    var tx;
    var startChanges;

    before(function(done){
      startChanges = sinon.stub(Transaction.prototype, "startChanges", function(callback) { callback(); });
      done();
    });

    beforeEach(function(done){
      
      var testUser1 = new TestUser({name: 'Bob'});
      var testUser2 = new TestUser({name: 'Alice'});

      tx = new Transaction({
        app: 'mocha',
        changes: [
          {
            coll: 'testusers',
            act: 'insert',
            docId: testUser1._id,
            data: testUser1
          },
          {
            coll: 'testusers',
            act: 'insert',
            docId: testUser2._id,
            data: testUser2
          }
        ]
      });
      tx.save(function(err){
        if(err) console.log("Error create test tx: err");
        done();
      });
    });

    afterEach(function(done){
      Transaction.remove(function(){
        TestSchema1.remove(function(){
          TestUser.remove(function(){
            tx = null;
            done();
          });
        })
      });
    });

    after(function(done){
      startChanges.restore();
      done();
    });

    it('should not set the transaction state to "started" when the version has changed', function(done){
      Transaction.findOneAndUpdate({
        _id: tx._id
      },
      {
        $inc: {__v: 1}
      },
      {
        new: true, 
        upsert: false
      }, 
      function(err, doc){
        should.not.exist(err);
        should.exist(doc);
        tx.start('mocha', function(err){
          should.exist(err);
          done();
        });
      });
    });

    it('should not set the transaction state to "started" when state is not "new"', function(done){
      Transaction.findOneAndUpdate({
        _id: tx._id
      },
      {
        state: "started"
      },
      {
        new: true, 
        upsert: false
      }, 
      function(err, doc){
        should.not.exist(err);
        should.exist(doc);
        tx.start('mocha', function(err){
          should.exist(err);
          done();
        });
      });
    });

    it('should set the transaction state to "started" when the version hasnt changed', function(done){
      tx.start('mocha', function(err){
        should.not.exist(err);
        Transaction.findOne({_id: tx._id}, function(err, doc){
          doc.state.should.equal('started');
          done();
        });
      });
    });
  });

  describe('#startChanges', function(){
    var startChange;
    var finish;
    var revert;

    before(function(){
      startChange = sinon.stub(Transaction.prototype, "startChange", function(self, change, callback) { callback(); });
      finish = sinon.stub(Transaction.prototype, "finish", function(callback) { callback(); });
      revert = sinon.stub(Transaction.prototype, "revert", function(err, callback) { callback(); });
    });

    afterEach(function(done){
      Transaction.remove(function(){
        TestSchema1.remove(function(){
          TestUser.remove(function(){
            done();
          });
        });
      });
    });

    after(function(){
      startChange.restore();
      finish.restore();
      revert.restore();
    });

    it('should call startChange once per change and call finish', function(done){
      var testUser1 = new TestUser({name: 'Bob'});
      var testUser2 = new TestUser({name: 'Alice'});

      var tx = new Transaction({
        app: 'mocha',
        changes: [
          {
            coll: 'testusers',
            act: 'insert',
            docId: testUser1._id,
            data: testUser1
          },
          {
            coll: 'testusers',
            act: 'insert',
            docId: testUser2._id,
            data: testUser2
          }
        ]
      });
      tx.save(function(err){
        if(err) { console.log('Error create test tx: '+err); }
        tx.start('mocha', function(err){
          (startChange.calledTwice).should.equal(true);
          (finish.calledOnce).should.equal(true);
          done();
        });
      });
    });

    it('should call startChange until error and call revert', function(done){
      startChange.restore();
      startChange = sinon.stub(Transaction.prototype, "startChange", function(self, change, callback) { 
        callback(new Error('error')); 
      });

      var testUser1 = new TestUser({name: 'Bob'});
      var testUser2 = new TestUser({name: 'Alice'});

      var tx = new Transaction({
        app: 'mocha',
        changes: [
          {
            coll: 'testusers',
            act: 'insert',
            docId: testUser1._id,
            data: testUser1
          },
          {
            coll: 'testusers',
            act: 'insert',
            docId: testUser2._id,
            data: testUser2
          }
        ]
      });
      tx.save(function(err){
        if(err) { console.log('Error create test tx: '+err); }
        tx.start('mocha', function(err){
          (startChange.calledOnce).should.equal(true);
          (revert.calledOnce).should.equal(true);
          done();
        });
      });
    });
  });

  describe('#startChange', function(){
    it('should not start a change that is in progress');
    it('should mark the correct job as started and call doChange');
    it('should not change more than 1 job');
  });

  describe('#doChange', function(){
    it('should call doInsert for inserts');
    it('should call doUpdate for updates');
    it('should call doUpsert for upserts');
    it('should call doRemove for removes');
    it('should call handleChangeResult when done');
  });

  describe('complete run', function(){
    beforeEach(function(done){
      Transaction.remove(function(){
        TestSchema1.remove(function(){
          TestUser.remove(function(){
            done();
          });
        })
      });
    });

    it('should do inserts', function(done){
      var testUser1 = new TestUser({name: 'Bob'});
      var testUser2 = new TestUser({name: 'Alice'});

      var tx = new Transaction({
        app: 'mocha',
        changes: [
          {
            coll: 'testusers',
            act: 'insert',
            docId: testUser1._id,
            data: testUser1
          },
          {
            coll: 'testusers',
            act: 'insert',
            docId: testUser2._id,
            data: testUser2
          }
        ]
      });
      tx.save(function(err){
        if(err) { 
          console.log('Error create test tx: '+err);
          done(err);
        }else{
          tx.start('mocha', function(err){
            done(err);
          });
        }
      });
    });

    it('should do updates', function(done){
      var bob = new TestUser({name: 'Bob', num: 1});
      var alice = new TestUser({name: 'Alice'});
      var mary = new TestUser({name: 'Mary', tags: ['you\'re it!']});
      var tom = new TestUser({name: 'Tom', num: 2 });

      var tx = new Transaction({
        app: 'mocha',
        changes: [
          {
            coll: 'testusers',
            act: 'update',
            docId: bob._id,
            data: {phone: '123-123-1234'},
            inc: {num: 1},
            prev: bob
          },
          {
            coll: 'testusers',
            act: 'update',
            docId: alice._id,
            push: {
              to: 'tags',
              data: 'you\'re it!'
            },
            prev: alice
          },
          {
            coll: 'testusers',
            act: 'update',
            docId: mary._id,
            pull: {
              from: 'tags',
              data: 'you\'re it!'
            },
            prev: mary
          },
          {
            coll: 'testusers',
            act: 'update',
            docId: tom._id,
            inc: {num: -1},
            prev: tom
          }
        ]
      });
      bob.save(function(err){
        if(err) { console.log('Error saving bob: '+err); }
        alice.save(function(err){
          if(err) { console.log('Error saving alice: '+err); }
          mary.save(function(err){
            if(err) { console.log('Error saving mary: '+err); }
            tom.save(function(err){
              if(err) { console.log('Error saving tom: '+err); }
              tx.save(function(err){
                if(err) { 
                  console.log('Error create test tx: '+err); 
                  done(err);
                }else{
                  tx.start('mocha', function(err){
                    done(err);
                  });
                }
              });
            });
          });
        });
      });
    });

    it('should do removes', function(done){
      var bob = new TestUser({name: 'Bob', num: 1});
      var alice = new TestUser({name: 'Alice'});

      var tx = new Transaction({
        app: 'mocha',
        changes: [
          {
            coll: 'testusers',
            act: 'remove',
            docId: bob._id,
            prev: bob
          },
          {
            coll: 'testusers',
            act: 'remove',
            docId: alice._id,
            prev: alice
          }
        ]
      });

      bob.save(function(err){
        if(err) { console.log('Error saving bob: '+err); }
        alice.save(function(err){
          if(err) { console.log('Error saving alice: '+err); }
          tx.save(function(err){
            if(err) { 
              console.log('Error create test tx: '+err); 
              done(err);
            }else{
              tx.start('mocha', function(err){
                done(err);
              });
            }
          });
        });
      });
    });

  });
  
});