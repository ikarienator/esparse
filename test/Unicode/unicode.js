({

/** "ab\xB5cd"; **/
"hex escape in string": {
    type: "Script",
    statements: [
    {   type: "ExpressionStatement",
        expression: {
            type: "String",
            value: "ab\xB5cd",
        }
    }]
},

/** "ab\u01BBcd"; **/
"unicode escape in string": {
    type: "Script",
    statements: [
    {   type: "ExpressionStatement",
        expression: {
            type: "String",
            value: "ab\u01BBcd",
        }
    }]
},

/** \u0064ebugger; **/
"keywords are detected after escaping": {
    type: "Script",
    statements: [
    {   type: "DebuggerStatement"
    }]
},

/** \u{64}efg; **/
"extended unicode escapes": {
    type: "Script",
    statements: [
    {   type: "ExpressionStatement",
        expression: {
            type: "Identifier",
            value: "defg"
        }
    }]
},

/** ƒ; **/
"unicode identifiers": {
    type: "Script",
    statements: [
    {   type: "ExpressionStatement",
        expression: {
            type: "Identifier",
            value: "ƒ"
        }
    }]
},

// FIX
/* \u0030abc; 
"cannot use espace sequence to create invalid identifiers": {}
*/

});