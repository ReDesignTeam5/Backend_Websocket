//replit: ws://Backend-Websocket.ranchu2000.repl.co/
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

var fe;
var hw;
var semaphore=0;

wss1.on("connection", function connection(ws) {
  console.log("wss1:: frontEnd connected");
  //ws.send(JSON.stringify("Connected to backend"));
  fe=ws;
  fe.on('message', (data)=>{
    console.log("received from frontend: "+data);
    if (hw){
        const message= JSON.parse(data);
        if (message.type=="check"){           
            fe.send(JSON.stringify(true)); //must connect Backend before FrontEnd
        }
        if (message.type=="level"){
            if (message.level==1){
                reportStatus(message.status);
            }else{
                if (semaphore==0){
                    semaphore=1;
                    gameLogic(message.coins, message.notes, message.prompt);
                }
            }
        }else{
            fe.send(JSON.stringify("Unrecognised message"));
        }
    }else{
        fe.send(JSON.stringify(false));
            //device.send(JSON.stringify("No hardware connected")); //must connect Backend before FrontEnd
    }
    });
    ws.on('close',(user)=>{
        console.log(user +" has disconnected");
    })
})

wss2.on("connection", function connection(ws) {
  console.log("wss2:: hardware connected");
  ws.send(JSON.stringify("Connected to backend"));
  hw=ws
  ws.on('message', (data)=>{
    console.log("received from backend: "+data);
  });
  ws.on('close',(user)=>{
    hw=null;
})
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
    successMsg= "0,0";
    failureMsg="0,1";
    if (success){
        fe.send(JSON.stringify(true));
        hw.send(successMsg);
    }else{
        fe.send(JSON.stringify(false));
        hw.send(failureMsg);
    }
}

async function gameLogic(coins, notes, prompt){
    hardwareMessage(coins, notes, prompt); //sends msg to hardware
    let promise= new Promise((resolve,reject)=>{
        hw.on('message', (data)=>{
            const message= data.toString();
            resolve(message);
        })
    })
    let answer= await promise;
    var result= calculate(coins,notes,answer);
    semaphore=0;
    if (result===prompt){
        reportStatus(true);
    }else{
        reportStatus(false);
    }
}

function hardwareMessage(coins,notes,prompt){
    hw.send("1,"+(coins).toString()+","+(notes).toString()+","+prompt.toString()); //1 infront for command
}

function calculate(coins,notes,answer){
    const coinArr = answer.split(',').map((x) =>parseInt(x));
    const valueArr=[.05,.1,.2,.5,1,2,5,10,50];
    var sum=0;
    coinArr.map((qty, index) => sum+=qty * valueArr[index]);
    console.log('Inserted amount is '+ sum);
    coinCount=0
    noteCount=0
    for (i=0; i<coinArr.length; i++)
    {
        if (i <=4){
            if (coinArr[i]>0){
                coinCount+=coinArr[i];
            }
        }else{
            if (coinArr[i]>0){
                noteCount+=coinArr[i];
            }
        }
    }
    if (coins==0){//only 1 coin
        if (coinCount>1 || noteCount>0){ 
            console.log('Wrong, inserted '+coinCount+ ' coins and '+ noteCount+' notes');
            return 0;
        }
    }else if (coins==2){//no coins
        if (coinCount>0){
            console.log('Wrong, inserted '+coinCount+ ' coins and '+ noteCount+' notes');
            return 0;
        }
    }
    if (notes==0){//only 1 note
        if (noteCount>1 || coinCount>0){
            console.log('Wrong, inserted '+coinCount+ 'c oins and '+ noteCount+' notes');
            return 0;
        }
    }else if (notes==2){//no notes
        if (noteCount>0){
            console.log('Wrong, inserted '+coinCount+ ' coins and '+ noteCount+' notes');
            return 0;
        }
    }
    
    return sum;
}