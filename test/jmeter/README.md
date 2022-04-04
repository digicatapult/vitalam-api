# JMeter

## Requirements

jdk 1.8 and above\
jmeter 5.4.1 (latest version was used)\
JMETER_HOME added to %PATH

## Run Tests

Create a file of a desired size (using an online generator, for example) and place the file within `./jmeter_tmp` directory.\
Obtain a valid Authorization token and pass this to the `jmeter` cli command as a parameter value to `-JtestAuthToken=`.\
Optionally, you can enable and run the Login Request to obtain this for you.

```
jmeter -t ./test/jmeter/Test_Plan.jmx -JtestFilePath={TEST_FILE_PATH} -JtestFilename={TEST_FILE_NAME} -JtestAuthToken={TEST_AUTH_TOKEN}

# For example:
jmeter -t ./test/jmeter/Test_Plan.jmx -JtestFilePath=./jmeter_tmp/test_file_01_1mb.txt -JtestFilename=test_file_01_1mb.txt -JtestAuthToken=
```

## Test Results

| File size | Threads | Loops | node.js CPU % | Docker CPU % | Success Rate |
| :-------: | :-----: | :---: | :-----------: | :----------: | :----------: |
|    1MB    |    1    |  10   |      15%      |     60%      |     100%     |
|   200MB   |    1    |  10   |      40%      |     320%     |     100%     |
|    1GB    |    1    |  10   |      40%      |     500%     |     100%     |

When multiple threads were used there was a (random number) reduction of successful transactions, the following is an example of the stack trace errors:

```
RPC-CORE: submitAndWatchExtrinsic(extrinsic: Extrinsic): ExtrinsicStatus:: 1014: Priority is too low: (759580530392 vs 759580530392): The transaction has too low priority to replace another transaction already in the pool.
DRR: Error: 1014: Priority is too low: (759580530392 vs 759580530392): The transaction has too low priority to replace another transaction already in the pool.
    at RpcCoder._checkError (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/@polkadot/rpc-provider/coder/index.cjs:84:13)
    at RpcCoder.decodeResponse (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/@polkadot/rpc-provider/coder/index.cjs:47:10)
    at WsProvider.value (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/@polkadot/rpc-provider/ws/index.cjs:231:90)
    at W3CWebSocket.value [as onmessage] (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/@polkadot/rpc-provider/ws/index.cjs:211:153)
    at W3CWebSocket._dispatchEvent [as dispatchEvent] (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/yaeti/lib/EventTarget.js:107:17)
    at W3CWebSocket.onMessage (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/websocket/lib/W3CWebSocket.js:234:14)
    at WebSocketConnection.<anonymous> (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/websocket/lib/W3CWebSocket.js:205:19)
    at WebSocketConnection.emit (events.js:375:28)
    at WebSocketConnection.processFrame (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/websocket/lib/WebSocketConnection.js:554:26)
    at /Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/websocket/lib/WebSocketConnection.js:323:40
RPC-CORE: submitAndWatchExtrinsic(extrinsic: Extrinsic): ExtrinsicStatus:: 1014: Priority is too low: (759580530392 vs 759580530392): The transaction has too low priority to replace another transaction already in the pool.
(node:6609) UnhandledPromiseRejectionWarning: Error: 1014: Priority is too low: (759580530392 vs 759580530392): The transaction has too low priority to replace another transaction already in the pool.
    at RpcCoder._checkError (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/@polkadot/rpc-provider/coder/index.cjs:84:13)
    at RpcCoder.decodeResponse (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/@polkadot/rpc-provider/coder/index.cjs:47:10)
    at WsProvider.value (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/@polkadot/rpc-provider/ws/index.cjs:231:90)
    at W3CWebSocket.value [as onmessage] (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/@polkadot/rpc-provider/ws/index.cjs:211:153)
    at W3CWebSocket._dispatchEvent [as dispatchEvent] (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/yaeti/lib/EventTarget.js:107:17)
    at W3CWebSocket.onMessage (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/websocket/lib/W3CWebSocket.js:234:14)
    at WebSocketConnection.<anonymous> (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/websocket/lib/W3CWebSocket.js:205:19)
    at WebSocketConnection.emit (events.js:375:28)
    at WebSocketConnection.processFrame (/Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/websocket/lib/WebSocketConnection.js:554:26)
    at /Users/dmorton/Projects/Digital_Catapult/dscp/dscp-api/node_modules/websocket/lib/WebSocketConnection.js:323:40
(node:6609) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 18)
```
