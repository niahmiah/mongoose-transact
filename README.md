# A transaction system for mongoose

## You probably shouldn't use this

To begin, if you are considering using this, then you are probably doing something wrong. Transactions were excluded from MongoDB for a reason. They are slow by nature, and create a need for a locking mechanism for all documents affected. However, sometimes you will find yourself painted into a corner, and will need a quick solution.

If you use this in your application, first consider that there might be a way to model things so that you do not need transactions. MongoDB embedded documents can be used to solve many problems. Storing a complete copy of a document in another document may seem wasteful, but storage is cheap. Raw performance at the expense of storage space is a good tradeoff.

## Before using mongoose-transact

If you decide to use mongoose-transact in your application anyway, there are some things to be aware of:

* You need to be very aware of how your application updates and removes documents in the collections that you will modify with mongoose-transact. You can continue to create new documents in these collections with mongoose *new* and *save*, but **otherwise, all updates and removes for that collection need to be changed to use mongoose-transact, even if they only modify one document**. This guarantees that any pending transactions for that document will be able to be completed or rolled back to the correct state.

* You will be trading write performance for a guaranteed state. **Expect things to be at least 5x slower**.

* Creating more than one transaction (with *new Transaction()*) that modifies a specific document will fail. The helper method .create() will allow you to request multiple transactions that affect a document, but since only one can be saved at a time, it will keep retrying the additional transactions until a timeout is reached and timeout error is sent. The timeout is 5 seconds by default, but can be overridden.

## How to use mongoose-transact

### Creating a transaction

**Transaction.create(data, callback)**  
**Transaction.create(data, timeout, callback)**

Available actions (act): "insert", "update", "remove"

Example: Inserting 2 documents:

>{  
&nbsp;&nbsp;"app": "MyAppName",  
&nbsp;&nbsp;"changes": [  
&nbsp;&nbsp;&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coll": "MyCollectionName",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"act": "insert",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"docId": ObjectID("MyObjectID1"),  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"data": {"whatever": "your document contains"},  
&nbsp;&nbsp;&nbsp;&nbsp;},  
&nbsp;&nbsp;&nbsp;&nbsp;{  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"coll": "MyCollectionName",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"act": "insert",  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"docId": ObjectID("MyObjectID2"),  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"data": {"whatever": "your document contains"},  
&nbsp;&nbsp;&nbsp;&nbsp;}  
&nbsp;&nbsp;]  
}  


