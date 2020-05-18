/*
Set up static file server
*/

/* Include static file webserver library */
var static = require('node-static');

/* Include the http server library */
var http = require('http');

/* Assume that we are running on Heroku */
var port = process.env.PORT;
var directory = __dirname + '/public';

/* If we aren't on Heroku, then we need to readjust the port and directory information, because port won't be set */
if(typeof port == 'undefined' || !port) {
  directory = './public';
  port = 8080;
}

/* Set up a static web-server that will deliver files from file system */
var file = new static.Server(directory);

/* Construct an http server that gets files from the file server */
var app = http.createServer(
  function(request, response) {
    request.addListener('end',
      function() {
        file.serve(request, response);
      }
    ).resume();
  }
).listen(port);

console.log('The server is running.');

/*
set up web socket server
*/
var io = require('socket.io').listen(app);

io.sockets.on('connection', function(socket) {
  function log() {
    var array = ['*** Server Log Message: '];
    for(var i = 0; i < arguments.length; i++) {
      array.push(arguments[i]);
      console.log(arguments[i]);
    }
    socket.emit('log', array);
    socket.broadcast.emit('log', array);
  }

  log('A web site connected to the server');

  socket.on('disconnect', function(socket) {
    log('A web site disconnected to the server');
  });

  /* join room command */
  /*
    payload:
    {
      'room': room to join,
      'username': username of person joining
    }
    join_room_response:
    {
      'result': 'success',
      'room': room joined,
      'username': username that joined,
      'membership': number of people in the room including new person
    }
    or
    {
      'result': 'fail',
      'message': failure message
    }
  */
  socket.on('join_room', function(payload) {
    log('server received command', 'join_room', payload);

    if(('undefined' === typeof payload) || !payload) {
      var error_message = 'join_room had no payload, command aborted';
      log(error_message);
      socket.emit('join_room_response', {
        result: 'fail',
        message: error_message
      });

      return;
    }

    var room = payload.room;
    if(('undefined' === typeof room) || !room) {
      var error_message = 'join_room didn\'t specify a room, command aborted';
      log(error_message);
      socket.emit('join_room_response', {
        result: 'fail',
        message: error_message
      });

      return;
    }

    var username = payload.username;
    if(('undefined' === typeof username) || !username) {
      var error_message = 'join_room didn\'t specify a username, command aborted';
      log(error_message);
      socket.emit('join_room_response', {
        result: 'fail',
        message: error_message
      });

      return;
    }

    socket.join(room);

    var roomObject = io.sockets.adapter.rooms[room];
    if(('undefined' === typeof roomObject) || !roomObject) {
      var error_message = 'join_room couldn\'t create a room (internal error), command aborted';
      log(error_message);
      socket.emit('join_room_response', {
        result: 'fail',
        message: error_message
      });

      return;
    }

    var numClients = roomObject.length;
    var success_data = {
      result: 'success',
      room: room,
      username: username,
      membership: (numClients + 1)
    };
    io.sockets.in(room).emit('join_room_response', success_data);
    log('Room "' + room + '" was just joined by ' + username);
  });

  /* send message command */
  /*
    payload:
    {
      'room': room to join,
      'username': username of person joining
    }
    send_message_response:
    {
      'result': 'success',
      'username': username of person that sent message,
      'message': the sent message
    }
    or
    {
      'result': 'fail',
      'message': failure message
    }
  */
  socket.on('send_message', function(payload) {
    log('server received command', 'send_message', payload);

    if(('undefined' === typeof payload) || !payload) {
      var error_message = 'send_message had no payload, command aborted';
      log(error_message);
      socket.emit('send_message_response', {
        result: 'fail',
        message: error_message
      });

      return;
    }

    var room = payload.room;
    if(('undefined' === typeof room) || !room) {
      var error_message = 'send_message didn\'t specify a room, command aborted';
      log(error_message);
      socket.emit('send_message_response', {
        result: 'fail',
        message: error_message
      });

      return;
    }

    var username = payload.username;
    if(('undefined' === typeof username) || !username) {
      var error_message = 'send_message didn\'t specify a username, command aborted';
      log(error_message);
      socket.emit('send_message_response', {
        result: 'fail',
        message: error_message
      });

      return;
    }

    var message = payload.message;
    if(('undefined' === typeof message) || !message) {
      var error_message = 'send_message didn\'t specify a message, command aborted';
      log(error_message);
      socket.emit('send_message_response', {
        result: 'fail',
        message: error_message
      });

      return;
    }

    var success_data = {
      result: 'success',
      room: room,
      username: username,
      message: message
    };
    io.sockets.in(room).emit('send_message_response', success_data);
    log('Message sent to room ' + room + ' by ' + username);
  });
});