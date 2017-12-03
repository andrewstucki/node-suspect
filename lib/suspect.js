"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var assert_1 = require("assert");
var child_process_1 = require("child_process");
var SpawnChain = /** @class */ (function () {
    function SpawnChain(command, args, options) {
        this.command = command;
        this.args = args;
        this.options = options;
        this.queue = [];
    }
    SpawnChain.prototype.expect = function (expectation) {
        this.queue.push({
            callback: function (data) {
                if (typeof expectation === "string") {
                    return data.indexOf(expectation) > -1;
                }
                return expectation.test(data);
            },
            description: "[expect] " + expectation,
            expected: expectation,
            type: "expect",
        });
        return this;
    };
    SpawnChain.prototype.wait = function (expectation, callback) {
        if (callback === void 0) { callback = function (_) { }; }
        this.queue.push({
            callback: function (data) {
                var match = false;
                if (typeof expectation === "string") {
                    match = data.indexOf(expectation) > -1;
                }
                else {
                    match = expectation.test(data);
                }
                if (match) {
                    callback(data);
                }
                return match;
            },
            description: "[wait] " + expectation,
            type: "wait",
        });
        return this;
    };
    SpawnChain.prototype.sendline = function (line) {
        var self = this;
        this.queue.push({
            callback: function () { self.process.stdin.write(line + "\n"); },
            description: "[sendline] " + line,
            type: "sendline",
        });
        return this;
    };
    SpawnChain.prototype.sendEof = function () {
        var self = this;
        this.queue.push({
            callback: function () { self.process.stdin.destroy(); },
            description: "[sendEof]",
            type: "eof",
        });
        return this;
    };
    SpawnChain.prototype.run = function (callback) {
        var self = this;
        var failed = false;
        var stdout = [];
        function onError(err, kill) {
            if (kill) {
                try {
                    self.process.kill();
                }
                catch (ex) { }
            }
            if (failed) {
                return;
            }
            failed = true;
            callback(err);
        }
        function evalQueue(previousType, data) {
            if (typeof data === "undefined") {
                return;
            }
            var currentFn = self.queue[0];
            if (!currentFn || ((previousType === "expect" || previousType === "wait") && currentFn.type === "expect")) {
                return;
            }
            switch (currentFn.type) {
                case "expect":
                    self.queue.shift();
                    if (currentFn.callback(data)) {
                        return evalQueue("expect", data);
                    }
                    var message = (typeof currentFn.expected === "string") ? "to contain" : "to match";
                    return new assert_1.AssertionError({
                        actual: data,
                        expected: currentFn.expected,
                        message: "expected " + data + " " + message + " " + currentFn.expected,
                    });
                case "wait":
                    if (currentFn.callback(data)) {
                        self.queue.shift();
                        return evalQueue("wait", data);
                    }
                    return;
                default:
                    self.queue.shift();
                    currentFn.callback();
                    var nextFn = self.queue[0];
                    if (nextFn && ["expect", "wait"].indexOf(nextFn.type) === -1) {
                        return evalQueue(currentFn.type, data);
                    }
                    return;
            }
        }
        function handleData(data) {
            data = data.toString().replace(/\u001b\[\d{0,2}./g, "");
            var lines = data.split("\n").filter(function (line) { return line.length > 0; });
            stdout = stdout.concat(lines);
            while (lines.length > 0) {
                var err = evalQueue("start", lines.shift());
                if (err) {
                    onError(err, true);
                    break;
                }
            }
        }
        function flushQueue() {
            var remainingQueue = self.queue.slice();
            var currentFn = self.queue.shift();
            var lastLine = stdout[stdout.length - 1];
            if (!lastLine) {
                onError(new assert_1.AssertionError({
                    actual: remainingQueue.map(function (fn) { return fn.description; }),
                    expected: [],
                    message: "No data from child with non-empty queue.",
                }));
                return false;
            }
            else if (self.queue.length > 0) {
                onError(new assert_1.AssertionError({
                    actual: remainingQueue.map(function (fn) { return fn.description; }),
                    expected: [],
                    message: "Non-empty queue on spawn exit.",
                }));
                return false;
            }
            else if (currentFn && currentFn.type === "sendline") {
                onError(new Error("Cannot call sendline after the process has exited"));
                return false;
            }
            else if (currentFn && currentFn.type === "wait" || currentFn.type === "expect") {
                if (currentFn.callback(lastLine) !== true) {
                    var message = (typeof currentFn.expected === "string") ? "to contain" : "to match";
                    onError(new assert_1.AssertionError({
                        actual: lastLine,
                        expected: currentFn.expected,
                        message: "expected " + lastLine + " " + message + " " + currentFn.expected,
                    }));
                    return false;
                }
            }
            return true;
        }
        var _a = self.options, stream = _a.stream, options = __rest(_a, ["stream"]);
        self.process = child_process_1.spawn(self.command, self.args, options);
        self.process[stream || "stdout"].on("data", handleData);
        self.process.on("error", onError);
        self.process.on("close", function (code, signal) {
            if (self.queue.length && !flushQueue()) {
                return;
            }
            callback(undefined, stdout, signal || code);
        });
        return self.process;
    };
    return SpawnChain;
}());
exports.SpawnChain = SpawnChain;
function spawn(command, args, options) {
    if (args === void 0) { args = []; }
    if (options === void 0) { options = {}; }
    return new SpawnChain(command, args, options);
}
exports.spawn = spawn;
