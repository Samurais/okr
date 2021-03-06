"use strict"

import co from 'co';
import {MongoClient, SocketIOTransport, ObjectId} from 'browser-mongodb/client';
import ioClient from 'socket.io-client';

const DISCONNECTED = 0;
const CONNECTING = 1;
const CONNECTED = 2;

var handleReject = function(reject) {
  return function(err) {
    console.log("------------------------ error in MongoDB Backend provider")
    console.log(err.stack)
    reject(err);
  }
}

export default class MongoDBBackend {
  constructor() {
    this.db = null;
    this.tags = null;
    this.okrs = null;
    this.objectives = null;
    this.users = null;
    this.comments = null;
    this.teams = null;
  }

  connect(url) {
    var self = this;
    url = url || 'http://localhost:9090';
    this.state = CONNECTING;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Client connection
        var client = new MongoClient(new SocketIOTransport(ioClient.connect, {}));
        // Attempt to connect
        self.client = yield client.connect(url);
        // Set connected state
        self.state = CONNECTED;
        // Get the collections
        self.db = self.client.db('okr');
        self.tags = self.db.collection('tags');
        self.okrs = self.db.collection('okrs');
        self.objectives = self.db.collection('objectives');
        self.users = self.db.collection('users');
        self.comments = self.db.collection('comments');
        self.teams = self.db.collection('teams');
        // Resolve
        resolve(self);
      }).catch(function(e) {
        self.state = DISCONNECTED;
        reject(e);
      });
    });
  }

  isConnected() {
    return this.client && this.client.isConnected();
  }

  /*****************************************************************************
   * OKR Methods
   ****************************************************************************/
  loadOKRById(id) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var okr = yield self.okrs
          .find({_id: id})
          .limit(1).next();
        // No OKR found
        if(!okr) return reject(new Error(`could not locate active okr for ${id}`));
        // Resolve the objectives
        okr.objectives = yield self.objectives
          .find({okr_id: okr._id})
          .toArray();
        // Resolve the user
        resolve(okr);
      }).catch(handleReject(reject));
    });
  }

  loadOKRByIds(ids) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var okrs = yield self.okrs
          .find({_id: { $in: ids }})
          .toArray();
        // Resolve the user
        resolve(okrs);
      }).catch(handleReject(reject));
    });
  }

  loadOKR(username, currentViewingUser) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var okr = yield self.okrs
          .find({username: username, active: true})
          .limit(1).next();
        if(!okr) return reject(new Error(`could not locate active okr for user ${username}`));
        // Resolve the objectives
        okr.objectives = yield self.objectives
          .find({okr_id: okr._id})
          .toArray();
        // Resolve the user
        resolve(okr);
      }).catch(handleReject(reject));
    });
  }

  loadTags() {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var results = yield self.tags
          .find({})
          .toArray();
        // Resolve the user
        resolve(results);
      }).catch(handleReject(reject));
    });
  }

  addOKRObjective(id, objective) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Set the okr id
        objective.okr_id = id;
        // Have the server send us the currently logged in user
        var result = yield self.objectives.insertOne(objective);
        if(result.insertedCount == 0) {
          return reject(new Error(`failed to add objective to okr`))
        }
        // Resolve the user
        resolve(result);
      }).catch(handleReject(reject));
    });
  }

  addOKRKeyResult(objectiveId, keyResult) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Add id to objective if none exits
        if(!keyResult.id) keyResult.id = new ObjectId();

        // Have the server send us the currently logged in user
        var result = yield self.objectives
          .updateOne({
            _id: objectiveId
          }, {
            $push: {'keyResults': keyResult}
          });

        if(result.modifiedCount == 0) {
          return reject(new Error(`could not locate objective with id ${objectiveId}`))
        }
        // Resolve the user
        resolve(result);
      }).catch(handleReject(reject));
    });
  }

  deleteKeyResult(objectiveId, keyResultId) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var result = yield self.objectives
          .updateOne({
            _id: objectiveId
          }, {
            $pull: { keyResults: { id: keyResultId } }
          });

        // No modification happened the key result does not exist
        if(result.modifiedCount == 0) {
          return reject(new Error(`could not locate key result with id ${keyResultId}`))
        }

        // Resolve the user
        resolve(result);
      }).catch(handleReject(reject));
    });
  }

  deleteObjective(objectiveId) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var result = yield self.objectives
          .deleteOne({
            _id: objectiveId
          });

        // No modification happened the objective does not exist
        if(result.deletedCount == 0) {
          return reject(new Error(`could not locate objective with id ${objectiveId}`))
        }
        // Resolve the user
        resolve(result);
      }).catch(handleReject(reject));
    });
  }

  updateKeyResultTags(objectiveId, keyResultId, tags) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var result = yield self.objectives
          .updateOne({
            _id: objectiveId, 'keyResults.id': keyResultId
          }, {
            $set: {'keyResults.$.tags': tags}
          });

        // No modification happened the key result does not exist
        if(result.deletedCount == 0) {
          return reject(new Error(`could not locate key result with id ${keyResultId}`))
        }

        // Resolve the user
        resolve(result);
      }).catch(handleReject(reject));
    });
  }

  updateObjectiveTags(objectiveId, tags) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var result = yield self.objectives
          .updateOne({
            _id: objectiveId
          }, {
            $set: {'tags': tags}
          });

        // No modification happened the objective does not exist
        if(result.modifiedCount == 0) {
          return reject(new Error(`could not locate objective with id ${objectiveId}`))
        }
        // Resolve the user
        resolve(result);
      }).catch(handleReject(reject));
    });
  }

  searchAll(searchTerm) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Search the objectives for matches
        var results = yield self.objectives
          .find({$text: {$search: searchTerm}})
          .toArray();
        // Resolve the user
        resolve(results);
      }).catch(handleReject(reject));
    });
  }

  linkKeyResult(objectiveId, keyResultId, linkObjectiveId, linkKeyResultId) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Grab the link objective
        var linkObjective = yield self.objectives
              .find({_id: linkObjectiveId})
              .limit(1).next();

        // Find the text
        if(linkKeyResultId) {
          for(var i = 0; i < linkObjective.keyResults.length; i++) {
            if(linkObjective.keyResults[i].id == linkKeyResultId) {
              var text = linkObjective.keyResults[i].keyResult;
              break;
            }
          }
        } else {
          var text = linkObjective.objective;
        }

        // Link object
        var linkObject = linkKeyResultId
          ? { objective_id: linkObjectiveId, key_result_id: linkKeyResultId, text: text }
          : { objective_id: linkObjectiveId, text: text };

        // Have the server send us the currently logged in user
        var result = yield self.objectives
          .updateOne({
            _id: objectiveId, 'keyResults.id': keyResultId
          }, {
            $set: { 'keyResults.$.link': linkObject }
          });

        // No modification happened the objective does not exist
        if(result.modifiedCount == 0) {
          return reject(new Error(`could not locate objective with id ${objectiveId}`))
        }

        // Resolve the user
        resolve();
      }).catch(handleReject(reject));
    });
  }

  linkObjective(objectiveId, linkObjectiveId, linkKeyResultId) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Grab the link objective
        var linkObjective = yield self.objectives
              .find({_id: linkObjectiveId})
              .limit(1).next();

        // Find the text
        if(linkKeyResultId) {
          for(var i = 0; i < linkObjective.keyResults.length; i++) {
            if(linkObjective.keyResults[i].id == linkKeyResultId) {
              var text = linkObjective.keyResults[i].keyResult;
              break;
            }
          }
        } else {
          var text = linkObjective.objective;
        }

        // Link object
        var linkObject = linkKeyResultId
          ? { objective_id: linkObjectiveId, key_result_id: linkKeyResultId, text: text }
          : { objective_id: linkObjectiveId, text: text };

        // Have the server send us the currently logged in user
        var result = yield self.objectives
          .updateOne({
            _id: objectiveId
          }, {
            $set: { 'link': linkObject }
          });

        // No modification happened the objective does not exist
        if(result.modifiedCount == 0) {
          return reject(new Error(`could not locate objective with id ${objectiveId}`))
        }

        // Resolve the user
        resolve();
      }).catch(handleReject(reject));
    });
  }

  /*****************************************************************************
   * User Methods
   ****************************************************************************/
  loadCurrent() {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Have the server send us the currently logged in user
        var user = yield self.client
          .db('okr')
          .command({currentUser: true});
        // Resolve the user
        resolve(user);
      }).catch(handleReject(reject));
    });
  }

  loadUser(username) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Grab the collections
        var users = self.client.db('okr').collection('users');
        var teams = self.client.db('okr').collection('teams');

        // Grab the user from the server
        var user = yield users
          .find({username: username})
          .limit(1).next();
        if(!user) return reject(new Error(`user with id ${username} not found`));

        if(user.reporting && user.reporting.managers) {
          // Resolve users
          user.reporting.managers = yield users
            .find({username: {$in: user.reporting.managers || []}}).toArray();
        }

        // Resolve the teams the user is in
        if(user.reporting && user.reporting.teams) {
          user.reporting.teams = yield teams
            .find({username: {$in: user.reporting.teams}}).toArray();

          // Resolve all the team members information
          for(var i = 0; i < user.reporting.teams.length; i++) {
            user.reporting.teams[i].members = yield users
              .find({username: {$in: user.reporting.teams[i].members}}).toArray();
          }
        }

        // Resolve the people the user manages if any
        if(user.reporting
          && user.reporting.manages
          && user.reporting.manages.people) {

          // Resolve users
          user.reporting.manages.people = yield users
            .find({username: {$in: user.reporting.manages.people || []}}).toArray();
        }

        // Resolve the teams the user manages if any
        if(user.reporting
          && user.reporting.manages
          && user.reporting.manages.teams) {

          // Resolve the teams
          user.reporting.manages.teams = yield teams
            .find({username: {$in: user.reporting.manages.teams}}).toArray();

          // Resolve all the team members information
          for(var i = 0; i < user.reporting.manages.teams.length; i++) {
            user.reporting.manages.teams[i].members = yield users
              .find({username: {$in: user.reporting.manages.teams[i].members}}).toArray();
          }
        }

        // Resolve the user
        resolve(user);
      }).catch(handleReject(reject));
    });
  }

  /*****************************************************************************
   * Comment Methods
   ****************************************************************************/
  loadObjectiveComments(ids) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        console.log("== loadObjectiveComments")
        console.log({objective_id: { $in: ids }})
        // Get the results
        var results = yield self.comments
          .find({objective_id: { $in: ids }})
          .toArray();
        // Resolve the user
        resolve(results);
      }).catch(handleReject(reject));
    });
  }

  loadComments(ids) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        console.log("== loadComments")
        console.log({_id: { $in: ids }})
        // Get the results
        var results = yield self.comments
          .find({_id: { $in: ids }})
          .toArray();
        // Resolve the user
        resolve(results);
      }).catch(handleReject(reject));
    });
  }

  addComment(from, message, tags) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Results from the update
        var result = yield self.comments
          .insertOne(Object.assign({
            _id: new ObjectId(),
            created: new Date(),
            avatar: from.avatar,
            from: from.name,
            from_username: from.username,
            message: message,
            resolved: false
          }, tags));

        // No modification happened the objective does not exist
        if(result.insertedCount == 0) {
          return reject(new Error(`could not save comment`))
        }

        // Resolve the reply added
        resolve();
      }).catch(handleReject(reject));
    });
  }

  updateComment(commentId, text) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Results from the update
        var result = yield self.comments
          .updateOne({
            _id: commentId,
          }, {
            $set: { message: text }
          });

        // No modification happened the objective does not exist
        if(result.modifiedCount == 0) {
          return reject(new Error(`could not update comment`))
        }

        // Resolve the reply added
        resolve();
      }).catch(handleReject(reject));
    });
  }

  deleteComment(commentId) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        console.log("== Comment deleteComment MONGODB 0")
        if(commentId.toHexString) {
          console.log(commentId.toHexString())
        } else {
          console.log(commentId)
        }
        // Results from the update
        console.log({ _id: commentId })
        var result = yield self.comments
          .deleteOne({ _id: commentId });
          console.log("== Comment deleteComment MONGODB 1")

        console.log(result)

        // No modification happened the objective does not exist
        if(result.deletedCount == 0) {
          return reject(new Error(`could not delete comment`))
        }
        console.log("== Comment deleteComment MONGODB 2")

        // Resolve the reply added
        resolve();
      }).catch(handleReject(reject));
    });
  }

  addReply(from, message, tags) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Results from the update
        var result = yield self.comments
          .updateOne(tags, {
            $push: { replies: {
              _id: new ObjectId(),
              created: new Date(),
              avatar: from.avatar,
              from: from.name,
              from_username: from.username,
              message: message
            }}
          });

        // No modification happened the objective does not exist
        if(result.modifiedCount == 0) {
          return reject(new Error(`could not save comment reply`))
        }

        // Resolve the reply added
        resolve();
      }).catch(handleReject(reject));
    });
  }

  updateReply(commentId, replyId, text) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Results from the update
        var result = yield self.comments
          .updateOne({
            _id: commentId, 'replies._id': replyId
          }, {
            $set: { 'replies.$.message': text }
          });

        // No modification happened the objective does not exist
        if(result.modifiedCount == 0) {
          return reject(new Error(`could not update comment reply`))
        }

        // Resolve the reply added
        resolve();
      }).catch(handleReject(reject));
    });
  }

  deleteReply(commentId, replyId) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Results from the update
        var result = yield self.comments
          .updateOne({
            _id: commentId
          }, {
            $pull: { replies: { _id: replyId } }
          });

        // No modification happened the objective does not exist
        if(result.modifiedCount == 0) {
          return reject(new Error(`could not delete comment reply`))
        }

        // Resolve the reply added
        resolve();
      }).catch(handleReject(reject));
    });
  }

  /*****************************************************************************
   * Search Methods
   ****************************************************************************/
  searchTeamAndUsers(searchTerm) {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function*() {
        // Search teams
        var teams = yield self.teams
          .find({$text: { $search: searchTerm }})
          .toArray();
        teams = teams.map(function(x) {
            x.type = 'team';
            return x;
          });
        // Search users
        var users = yield self.users
          .find({$text: { $search: searchTerm }})
          .toArray();
        users = users.map(function(x) {
            x.type = 'user';
            return x;
          });

        // Resolve the search
        resolve(teams.concat(users));
      }).catch(handleReject(reject));
    });
  }
}
