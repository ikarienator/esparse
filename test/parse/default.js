import { parse } from "../../build/default.js";
import { runTests, objectLike } from "../runner.js";

const inspect = require("util").inspect;

const SKIP_KEYS = {

    "start": 1,
    "end": 1,
    "message": 1,
    "context": 1,
    "error": 1
}

// Returns true if the specified AST is "like" another AST
function astLike(a, b) {

    return objectLike(a, b, SKIP_KEYS);
}

// Displays an object tree
function displayTree(tree) {

    return inspect(tree, false, 20, true);
}

runTests({

    dir:  __dirname,
    render: displayTree,
    process: (input, options) => parse(input, options).ast,
    compare: astLike

});
