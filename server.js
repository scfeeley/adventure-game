const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if(req.method === "GET" && req.url === '/'){
      //read the new player html form
      const newPlayer = fs.readFileSync("./views/new-player.html", "utf-8");
      //get the string of available rooms from world
      let availableRooms = world.availableRoomsToString();
      //replace the available rooms placeholder with actual available rooms 
      const newPlayerWithRooms = newPlayer.replace('#{availableRooms}', availableRooms)
      //set status and headers
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(newPlayerWithRooms);
    }
    // Phase 2: POST /player
    if(req.method === "POST" && req.url === '/player'){
      //get the player name and starting room from the form 
      const {name , roomId} = req.body;
      //create a new player with submitted values 
      player = new Player(name, world.rooms[roomId]);
      //set status and headers 
      res.statusCode = 302; 
      console.log("room ID: ", roomId);
      res.setHeader("Location", `/rooms/${roomId}`);
      return res.end();
    }
    // Phase 3: GET /rooms/:roomId
    let split = req.url.split("/");
    if(req.method === "GET" && split.length === 3 && req.url.startsWith("/rooms/")){
      //get room instance
      let roomId = split[2];
      let room = world.rooms[roomId];
      //get room template
      const roomHTML = fs.readFileSync("./views/room.html", "utf-8");
      //replace all template values with desired values 
      let roomHTMLReplace = roomHTML.replaceAll("#{roomName}", room.name);
      roomHTMLReplace = roomHTMLReplace.replace("#{roomItems}", room.itemsToString());
      roomHTMLReplace = roomHTMLReplace.replace("#{exits}", room.exitsToString());
      roomHTMLReplace =roomHTMLReplace.replace('#{inventory}', player.inventoryToString());
      //set status and return headers 
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(roomHTMLReplace);
    }
    // Phase 4: GET /rooms/:roomId/:direction
    if(req.method === "GET" && req.url.startsWith("/rooms/") && split.length === 4){
      //parse the url to get the roomId and direction
      let roomId = split[2];
      let direction = split[3].toLowerCase()[0];
      //ensure roomId matches player's current room 
      if(player.currentRoom.name === world.rooms[roomId].name){
        //move the player in direction
        player.move(direction);
      }
        //redirect to current room 
        res.statusCode = 302; 
        let currRoomId = getRoomIdByName(player.currentRoom.name);
        res.setHeader("Location", `/rooms/${currRoomId}`);
        return res.end(); 
      }

    // Phase 5: POST /items/:itemId/:action
      if(req.method === "POST" && req.url.startsWith("/items/") && split.length === 4){
        let itemId = split[2];
        let action = split[3];
        try{
          switch(action){
          case "drop":
            player.dropItem(itemId);
            break;
          case "eat":
            player.eatItem(itemId);
            break;
          case "take":
            console.log(itemId);
            player.takeItem(itemId);
            break;
        }
      }catch(e){
        let errrorHTML = fs.readFileSync("./views/error.html", "utf-8");
        errrorHTML = errrorHTML.replace("#{errorMessage}", e.message);
        errorHTML = errrorHTML.replace("#{roomId}", getRoomIdByName(player.currentRoom.name) )
        console.log("caught error");
        res.statusCode = 200; 
        res.setHeader("Content-Type", "text/html");
        return res.end(errorHTML);
      }
        res.statusCode = 302;
        res.setHeader('Location', `/rooms/${getRoomIdByName(player.currentRoom.name)}`)
        return res.end(); 
      }

    // Phase 6: Redirect if no matching route handlers
    res.statusCode = 404;
    res.setHeader('Location', `/rooms/${getRoomIdByName(player.currentRoom.name)}`)
    return res.end(); 
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));

function getRoomIdByName(roomName){
  for(let key in world.rooms){
    if(world.rooms[key].name === roomName){
      return key;
    }
  }
  return false;
}