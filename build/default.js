"use strict";

var Parser = require("./Parser.js").Parser;
var ScopeResolver = require("./ScopeResolver.js").ScopeResolver;
var AST = require("./AST.js");

function addParentLinks(node) {
    node.children().forEach(function (child) {
        child.parent = node;
        addParentLinks(child);
    });
}

function parse(input, options) {
    options = options || {};

    var result = new Parser().parse(input, options);

    if (options.resolveScopes) new ScopeResolver().resolve(result);

    if (options.addParentLinks) addParentLinks(result.ast);

    return result;
}

exports.AST = AST;
exports.parse = parse;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9kZWZhdWx0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0lBQVMsTUFBTSxXQUFRLGFBQWEsRUFBM0IsTUFBTTtJQUNOLGFBQWEsV0FBUSxvQkFBb0IsRUFBekMsYUFBYTtJQUNWLEdBQUcsV0FBTSxVQUFVOztBQUUvQixTQUFTLGNBQWMsQ0FBQyxJQUFJLEVBQUU7QUFFMUIsUUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFBLEtBQUssRUFBSTtBQUU3QixhQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztBQUNwQixzQkFBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ3pCLENBQUMsQ0FBQztDQUNOOztBQUVELFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUU7QUFFM0IsV0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7O0FBRXhCLFFBQUksTUFBTSxHQUFHLElBQUksTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQzs7QUFFaEQsUUFBSSxPQUFPLENBQUMsYUFBYSxFQUNyQixJQUFJLGFBQWEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzs7QUFFeEMsUUFBSSxPQUFPLENBQUMsY0FBYyxFQUN0QixjQUFjLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDOztBQUUvQixXQUFPLE1BQU0sQ0FBQztDQUNqQjs7UUFHRyxHQUFHLEdBQUgsR0FBRztRQUNILEtBQUssR0FBTCxLQUFLIiwiZmlsZSI6InNyYy9kZWZhdWx0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4vUGFyc2VyLmpzXCI7XG5pbXBvcnQgeyBTY29wZVJlc29sdmVyIH0gZnJvbSBcIi4vU2NvcGVSZXNvbHZlci5qc1wiO1xuaW1wb3J0ICogYXMgQVNUIGZyb20gXCIuL0FTVC5qc1wiO1xuXG5mdW5jdGlvbiBhZGRQYXJlbnRMaW5rcyhub2RlKSB7XG5cbiAgICBub2RlLmNoaWxkcmVuKCkuZm9yRWFjaChjaGlsZCA9PiB7XG5cbiAgICAgICAgY2hpbGQucGFyZW50ID0gbm9kZTtcbiAgICAgICAgYWRkUGFyZW50TGlua3MoY2hpbGQpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBwYXJzZShpbnB1dCwgb3B0aW9ucykge1xuXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICBsZXQgcmVzdWx0ID0gbmV3IFBhcnNlcigpLnBhcnNlKGlucHV0LCBvcHRpb25zKTtcblxuICAgIGlmIChvcHRpb25zLnJlc29sdmVTY29wZXMpXG4gICAgICAgIG5ldyBTY29wZVJlc29sdmVyKCkucmVzb2x2ZShyZXN1bHQpO1xuXG4gICAgaWYgKG9wdGlvbnMuYWRkUGFyZW50TGlua3MpXG4gICAgICAgIGFkZFBhcmVudExpbmtzKHJlc3VsdC5hc3QpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IHtcbiAgICBBU1QsXG4gICAgcGFyc2UsXG59O1xuIl19
