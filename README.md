mongoose-transact
=================

[![Greenkeeper badge](https://badges.greenkeeper.io/niahmiah/mongoose-transact.svg)](https://greenkeeper.io/)

[![NPM Package](https://img.shields.io/npm/v/mongoose-transact.svg?style=flat-square)](https://www.npmjs.org/package/mongoose-transact)
[![Build Status](https://img.shields.io/travis/niahmiah/mongoose-transact.svg?branch=master&style=flat-square)](https://travis-ci.org/niahmiah/mongoose-transact)
[![Coverage Status](https://img.shields.io/coveralls/niahmiah/mongoose-transact.svg?style=flat-square)](https://coveralls.io/r/niahmiah/mongoose-transact)

A transaction system for mongoose

## You probably shouldn't use this

To begin, if you are considering using this, then you are probably doing something wrong. Transactions were excluded from MongoDB for a reason. They are slow by nature, and create a need for a locking mechanism for all documents affected. However, sometimes you will find yourself painted into a corner, and will need a quick solution.

If you want to use this in your application, first consider that there might be a way to model things so that you do not need transactions. MongoDB embedded documents can be used to solve many problems. Storing a complete copy of a document in another document may seem wasteful, but storage is cheap. Raw performance at the expense of storage space is a good tradeoff.

## Before using mongoose-transact

If you decide to use mongoose-transact in your application anyway, there are some things to be aware of:

* You need to be very aware of how your application updates and removes documents in the collections that you will modify with mongoose-transact. You can continue to create new documents in these collections with mongoose *new* and *save*, but **otherwise, all updates and removes for that collection need to be changed to use mongoose-transact, even if they only modify one document**. This guarantees that any pending transactions for that document will be able to be completed or rolled back to the correct state.

* You will be trading write performance for a guaranteed state. **Expect things to be at least 5x slower**.

* Creating more than one transaction (with *new Transaction()*) that modifies a specific document will fail. The helper method .create() will allow you to request multiple transactions that affect a document, but since only one can be saved at a time, it will keep retrying the additional transactions until a timeout is reached and timeout error is sent. The timeout is 5 seconds by default, but can be overridden.

## How to use mongoose-transact

Transactions will either be completed, meaning that all changes in the transaction are persisted, or all changes will be reverted if any single change encounters an error. If all changes in the transaction complete without error, then the error in the callback will be null. Otherwise, if the changes in the transaction encounter an error and the documents have to be reverted, the error in the callback will not be null, and your application can handle the problem or alert the admin of the issue.

### Creating a transaction

**Transaction.create(data, callback)**  
**Transaction.create(data, timeout, callback)**

* timeout (optional) is in seconds
* callback responds with error or null

###All transactions require the following fields:  
* app (String): this is the name of your application, server hostname, etc  
* changes (Array): this is the array of changes to include in the transaction

An example *data* object to insert 2 documents, that credit and debit user accounts:

* insert requires *coll, act, docId, data* 

>{  
&nbsp;&nbsp;"app": "MyAppName",  
&nbsp;&nbsp;"changes": [  
&nbsp;&nbsp;&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coll": "MyCollectionName",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"act": "insert",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"docId": ObjectID("MyObjectID1"),  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"data": {"amount": 5, "whatever": "your document contains"},  
&nbsp;&nbsp;&nbsp;&nbsp;},  
&nbsp;&nbsp;&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coll": "MyCollectionName",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"act": "insert",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"docId": ObjectID("MyObjectID2"),  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"data": {"amount": -5, "whatever": "your document contains"},  
&nbsp;&nbsp;&nbsp;&nbsp;}  
&nbsp;&nbsp;]  
}  

An example *data* object to remove 2 documents:

* remove requires *coll, act, docId* 

>{  
&nbsp;&nbsp;"app": "MyAppName",  
&nbsp;&nbsp;"changes": [  
&nbsp;&nbsp;&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coll": "MyCollectionName",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"act": "remove",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"docId": ObjectID("MyObjectID1")&nbsp;&nbsp;&nbsp;&nbsp;},  
&nbsp;&nbsp;&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coll": "MyCollectionName",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"act": "remove",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"docId": ObjectID("MyObjectID2")&nbsp;&nbsp;&nbsp;&nbsp;}  
&nbsp;&nbsp;]  
}  

An example *data* object to update 2 documents:

* update requires *coll, act, docId*, and at least one of the 4 following:
* *inc* (Object): an object of field names and value to increment
* *push* (Object): an object in the format { to: "fieldname", data: "whatever datatype you want to push", v: 4}. Only *to* and *data* are required. *v* is the document's __v version field to make sure things havent changed since your request*
* *pull* (Object): an object in the format { from: "fieldname", data: "whatever datatype you want to pull", v: 4}. Only *from* and *data* are required. *v* is the document's __v version field to make sure things havent changed since your request*
* *data* (Object): An object containing just the fields and values you want to update with Mongo's $set operator.

>{  
&nbsp;&nbsp;"app": "MyAppName",  
&nbsp;&nbsp;"changes": [  
&nbsp;&nbsp;&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coll": "MyCollectionName",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"act": "update",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"docId": ObjectID("MyObjectID1"),  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"data": {"whatever": "your document contains"},  
&nbsp;&nbsp;&nbsp;&nbsp;},  
&nbsp;&nbsp;&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coll": "MyCollectionName",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"act": "update",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"docId": ObjectID("MyObjectID2"),  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"data": {"whatever": "your document contains"},  
&nbsp;&nbsp;&nbsp;&nbsp;}  
&nbsp;&nbsp;]  
}  

Additional info

* You can mix and match the actions, to insert and remove, insert and update, etc.  
* You can modify more than 2 documents.
&nbsp;  
&nbsp;  

##Cleaning up after a system restart
If a transaction is left in an incomplete state due to a system restart, there is a method for finding and reverting those transactions:

**cleanupOldJobs(expiredDate, app, callback)**  
This static method allows you to provide a timestamp to compare to the transaction's *lastModifiedDate*, and if the last modification was older than the expiredDate, it reverts the transaction. 

The *app* field can be set to null to find transactions for any app, or it can be specified to allow you to cleanup only transactions for that app name.

##Testing

From within the directory containing this source:

>npm install && npm test

##Fork it!
Pull requests, issues, and feedback are welcome.
