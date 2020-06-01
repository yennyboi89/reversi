/*set up the static file server*/

/* include static file webserver library */

var static = require('node-static');

/* include the http server library */
var http = require('http');

/* assume that we are running on Heroku */
var port = process.env.PORT;
var directory = __dirname + '/public';

/* if we aren't on heroku, then we need to readjust the port and directory information and we know that because port won't be set */
if (typeof port == 'undefined' || !port){
    directory = './public';
    port = 8080;
}
/* set up static web-server that will deliver files from the filesystem */
var file = new static.Server(directory);

/* construct an http server that gets files from the files server*/
var app = http.createServer(
    function(request, response){
        request.addListener('end',
            function(){
                file.serve(request,response);
            }
        ).resume();
    }
).listen(port);

console.log('The server is running');


/* set up the web socket server*/
/*  a registry of socket_ids and player information */
var players = [];

var io = require('socket.io').listen(app);
io.sockets.on('connection', function(socket){
    log('Client connect by ' + socket.id);
    function log(){
        var array = ['*** Server log Message: '];
        for (var i = 0; i < arguments.length; i++){
            array.push(arguments[i]);
            console.log(arguments[i]);
        }
        socket.emit('log', array);
        socket.broadcast.emit('log', array);
    }



/* join room command*/
/* payload:
{ 
    room: room to join,
    username: username of person joining
}
join_room_response {
    results: success,
    room: room joined,
    username: username that joined,
    socket_id: the socket id of the person that joined
    membership: number of people in the room including the new one. 
} or 
{
    results: fail,
    message: fail message;
}
*/
    socket.on('join_room', function(payload){
        log('\'join_room\' command' + JSON.stringify(payload));
        /* check that the client sent a payload*/
        if (('underfined' === typeof payload) || !payload){
            var error_message = 'join_room ha no payload, command aborted';
            log(error_message);
            socket.emit('join_room_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* check that payload has room to join */
        var room =payload.room;
        if (('underfined' === typeof room) || !room){
            var error_message = 'join_room didn\'t specify a room, command aborted';
            log(error_message);
            socket.emit('join_room_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /* check that a username has been provided*/
        var username =payload.username;
        if (('underfined' === typeof username) || !username){
            var error_message = 'join_room didn\'t specify a username, command aborted';
            log(error_message);
            socket.emit('join_room_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        /*Store information about this new player */
        players[socket.id] = {};
        players[socket.id].username = username;
        players[socket.id].room = room;

        /*have the user join the room */
        socket.join(room);
        /* get the room object */
        var roomObject = io.sockets.adapter.rooms[room];
        /* tell everyone in the room that someone just joined */
        var numClients = roomObject.length;
        var success_data = {
            result: 'success',
            room: room,
            username: username,
            socket_id: socket.id,
            membership: numClients
        };
        io.sockets.in(room).emit('join_room_response', success_data);

        for(var socket_in_room in roomObject.sockets){
            var success_data = {
                result: 'success',
                room: room,
                username: players[socket_in_room].username,
                socket_id: socket_in_room,
                membership: numClients
            };
            socket.emit('join_room_response', success_data);
        }

        log('join_room success');
    }
    );

    socket.on('disconnect', function(){
        log('client disconnected ' + JSON.stringify(players[socket.id]));
        if ( 'undefined' !== typeof players[socket.id] && players[socket.id]){
            var username = players[socket.id].username;
            var room = players[socket.id].room;
            var payload = {
                username: username,
                socket_id: socket.id
            };
            delete players[socket.id];
            io.in(room).emit('player_disconnected', payload);
        }
    });

    /* send_message command*/
/* payload:
{ 
    room: room to join,
    message: the message to send
}
send_message_response {
    results: success,
    username: username that joined,
    message: the message spoken;
} or 
{
    results: fail,
    message: fail message;
}
*/

    socket.on('send_message', function(payload){
        log('server received a command', 'send_message', payload);
        if (('underfined' === typeof payload) || !payload){
            var error_message = 'send_message has no payload, command aborted';
            log(error_message);
            socket.emit('send_message_response', {
                result: 'fail',
                message: error_message
            }); 
            return
        }
        var room =payload.room;
        if (('underfined' === typeof room) || !room){
            var error_message = 'send_message didn\'t specify a room, command aborted';
            log(error_message);
            socket.emit('send_message_response', {
                result: 'fail',
                message: error_message
            });
            return
        }
        var username = players[socket.id].username;
        if (('underfined' === typeof username) || !username){
            var error_message = 'send_message didn\'t specify a username, command aborted';
            log(error_message);
            socket.emit('send_message_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var message =payload.message;
        if (('underfined' === typeof message) || !message){
            var error_message = 'send_message didn\'t specify a message, command aborted';
            log(error_message);
            socket.emit('send_message_response', {
                result: 'fail',
                message: error_message
            });
            return
        }

        var success_data = {
            result : 'success',
            room: room,
            username: username,
            message: message
        };
    
        io.in(room).emit('send_message_response', success_data);
        log('Message sent to room ' + room + ' by ' + username);
    }
    );


    
/* invite command*/
/* payload:
{ 
   requested_user: the socket id of the person to be invited,
}
invite_response {
    results: success,
    socket_id: the socket id of the username of the person being invited
} or 
{
    results: fail,
    message: fail message;
}

invited {
    results: success,
    socket_id: the socket id of the username of the person being invited
}or 
{
    results: fail,
    message: fail message;
} 
*/

socket.on('invite', function(payload){
    log('invite with ' + JSON.stringify(payload));
    /* check to make sure that a payload was sent */
    if (('underfined' === typeof payload) || !payload){
        var error_message = 'invite has no payload, command aborted';
        log(error_message);
        socket.emit('invite_response', {
            result: 'fail',
            message: error_message
        }); 
        return
    }
    /* check the message can be traced to a username */
    var username =players[socket.id].username;
    if (('underfined' === typeof username) || !username){
        var error_message = 'invite cannot identify who sent the message, command abort';
        log(error_message);
        socket.emit('invite_response', {
            result: 'fail',
            message: error_message
        });
        return
    }

    var requested_user =payload.requested_user;
    if (('underfined' === typeof requested_user) || !requested_user){
        var error_message = 'invite didnot specify a reuquested_user, command abort';
        log(error_message);
        socket.emit('invite_reponse', {
            result: 'fail',
            message: error_message
        });
        return
    }

    var room = players[socket.id].room;
    var roomObject = io.sockets.adapter.rooms[room];
    /* make sure the user being invited is in the room */
    if(!roomObject.sockets.hasOwnProperty(requested_user)){
        var error_message = 'invite reuquested a user that was not in the room, command abort';
        log(error_message);
        socket.emit('invite_reponse', {
            result: 'fail',
            message: error_message
        });
        return
    }
    /* if everything is okay reponsed to the inviter that it was sucessful*/

    var success_data = {
        result : 'success',
        socket_id: requested_user
    };
    socket.emit('invite_response', success_data);

     /* tell the invitee that they have been invited*/

     var success_data = {
        result : 'success',
        socket_id: socket.id,
    };
    socket.to(requested_user).emit('invited', success_data);
    log('invite successful');
});

/* uninvite command*/
/* payload:
{ 
   requested_user: the socket id of the person to be uninvited,
}
uninvite_response {
    results: success,
    socket_id: the socket id of the username of the person being uninvited
} or 
{
    results: fail,
    message: fail message;
}

uninvited {
    results: success,
    socket_id: the socket id of the username of the person being univited
}or 
{
    results: fail,
    message: fail message;
} 
*/

socket.on('uninvite', function(payload){
    log('uninvite with ' + JSON.stringify(payload));
    /* check to make sure that a payload was sent */
    if (('underfined' === typeof payload) || !payload){
        var error_message = 'uninvite has no payload, command aborted';
        log(error_message);
        socket.emit('uninvite_response', {
            result: 'fail',
            message: error_message
        }); 
        return
    }
    /* check the message can be traced to a username */
    var username =players[socket.id].username;
    if (('underfined' === typeof username) || !username){
        var error_message = 'uninvite cannot identify who sent the message, command abort';
        log(error_message);
        socket.emit('uninvite_response', {
            result: 'fail',
            message: error_message
        });
        return
    }

    var requested_user =payload.requested_user;
    if (('underfined' === typeof requested_user) || !requested_user){
        var error_message = 'uninvite didnot specify a reuquested_user, command abort';
        log(error_message);
        socket.emit('uninvite_reponse', {
            result: 'fail',
            message: error_message
        });
        return
    }

    var room = players[socket.id].room;
    var roomObject = io.sockets.adapter.rooms[room];
    /* make sure the user being invited is in the room */
    if(!roomObject.sockets.hasOwnProperty(requested_user)){
        var error_message = 'invite reuquested a user that was not in the room, command abort';
        log(error_message);
        socket.emit('invite_reponse', {
            result: 'fail',
            message: error_message
        });
        return
    }
    /* if everything is okay reponsed to the uninviter that it was sucessful*/

    var success_data = {
        result : 'success',
        socket_id: requested_user
    };
    socket.emit('uninvite_response', success_data);

     /* tell the uninvitee that they have been uninvited*/

     var success_data = {
        result : 'success',
        socket_id: socket.id,
    };
    socket.to(requested_user).emit('uninvited', success_data);
    log('uninvite successful');
});



/* game start command*/
/* payload:
{ 
   requested_user: the socket id of the person to play with
}
game_start_response {
    results: success,
    socket_id: the socket id of the username of the person you are playing with
    game_id: id of the game session
} 
or 
{
    results: fail,
    message: fail message;
} 
*/

socket.on('game_start', function(payload){
    log('game_start with ' + JSON.stringify(payload));
    /* check to make sure that a payload was sent */
    if (('underfined' === typeof payload) || !payload){
        var error_message = 'game_start has no payload, command aborted';
        log(error_message);
        socket.emit('game_start_response', {
            result: 'fail',
            message: error_message
        }); 
        return
    }
    /* check the message can be traced to a username */
    var username =players[socket.id].username;
    if (('underfined' === typeof username) || !username){
        var error_message = 'game_start cannot identify who sent the message, command abort';
        log(error_message);
        socket.emit('game_start_response', {
            result: 'fail',
            message: error_message
        });
        return
    }

    var requested_user =payload.requested_user;
    if (('underfined' === typeof requested_user) || !requested_user){
        var error_message = 'game_start didnot specify a reuquested_user, command abort';
        log(error_message);
        socket.emit('game_start_response', {
            result: 'fail',
            message: error_message
        });
        return
    }

    var room = players[socket.id].room;
    var roomObject = io.sockets.adapter.rooms[room];
    /* make sure the user being invited is in the room */
    if(!roomObject.sockets.hasOwnProperty(requested_user)){
        var error_message = 'game_start reuquested a user that was not in the room, command abort';
        log(error_message);
        socket.emit('game_start_response', {
            result: 'fail',
            message: error_message
        });
        return
    }
    /* if everything is okay reponsed to the game starter that it was sucessful*/
    var game_id = Math.floor((1+Math.random()) * 0x10000).toString(16).substring(1);
    var success_data = {
        result : 'success',
        socket_id: requested_user,
        game_id: game_id
    };
    socket.emit('game_start_response', success_data);

     /* tell the other play to play*/

     var success_data = {
        result : 'success',
        socket_id: socket.id,
        game_id: game_id
    };
    socket.to(requested_user).emit('game_start_response', success_data);
    log('game_start successful');
});


});

