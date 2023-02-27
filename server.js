//replit: ws://Backend-Websocket.ranchu2000.repl.co/frontEnd
const http = require(`http`);
const ws = require(`ws`);
const url = require(`url`);

// Create the https server
const server = http.createServer();

// Create two instance of the websocket server
//ws1: FrontEnd to WebSocketServer
//ws2: ESP32 to WebSocketServer
const wss1 = new ws.WebSocketServer({ noServer: true });
const wss2 = new ws.WebSocketServer({ noServer: true });

const fe = new Set();
var hw;

wss1.on("connection", function connection(ws) {
  console.log("wss1:: frontEnd connected");
  ws.send(JSON.stringify("Connected to backend"));
  fe.add(ws);
  ws.on('message', (data)=>{
    if (hw){
        const message= JSON.parse(data);
        console.log(message);
        if (message.type="level"){
            if (message.level==1){
                reportStatus(message.status);
            }else{
                gameLogic(message.level==2, message.prompt);
            }
        }else{
            for (const device of fe) {
                device.send("Unrecognised message");
            }
        }
    }else{
        for (const device of fe) {
            device.send("No hardware connected"); //must connect Backend before FrontEnd
        }
    }
    });
})

wss2.on("connection", function connection(ws) {
  console.log("wss2:: hardware connected");
  ws.send(JSON.stringify("Connected to backend"));
  hw=ws
})

server.on("upgrade", function upgrade(request, socket, head) {
    const { pathname } = url.parse(request.url);
    console.log(`Path name ${pathname}`);

    if (pathname === "/frontEnd") {
        wss1.handleUpgrade(request, socket, head, function done(ws) {
        wss1.emit("connection", ws, request);
        });
    } else if (pathname === "/hardware") {
        wss2.handleUpgrade(request, socket, head, function done(ws) {
        wss2.emit("connection", ws, request);
        });
    } else {
        socket.destroy();
    }
    });
server.listen(8080);
console.log('Node.js web server at port 8080 is running..');

function reportStatus(success){
    if (success){
        for (const device of fe) {
            device.send(0);
        }
        hw.send(0);
    }else{
        for (const device of fe) {
            device.send(1);
        }
        hw.send(1);
    }
}

function reportPartialStatus(input,correct,chance,total){
    for (const device of fe) {
        device.send(input.toString()+","+correct.toString()+","+chance.toString()+","+total.toString());
    }
    hw.send(input.toString()+","+correct.toString()+","+chance.toString()+","+total.toString());
}

async function gameLogic(multipleCoins,prompt){
    var totalAttempts=3;
    var attempt=0;
    var correct=false;
    while (attempt <3 && !correct){
        hardwareMessage(multipleCoins,prompt);
        let promise= new Promise((resolve,reject)=>{
            hw.on('message', (data)=>{
                const message= JSON.parse(data);
                resolve(message.answer);
            })
        })
        let answer= await promise;
        var result= calculate(answer);
        attempt+=1;
        if (result===prompt){
            reportStatus(true);
        }else{
            reportPartialStatus(result,prompt,totalAttempts-attempt,totalAttempts);
        }
    }
    if (attempt==3){
        reportStatus(false);
    }
}

function hardwareMessage(multipleCoins, prompt){
    hw.send((multipleCoins?0:1).toString()+","+prompt.toString());
}

function calculate(answer){
    const coinArr = answer.split(',').map((item)=>parseInt(item, 10));
    const valueArr=[.1,.2,.5,1];
    var sum=0;
    coinArr.map((qty, index) => sum+=qty * valueArr[index]);
    return sum;
}