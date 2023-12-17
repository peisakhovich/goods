/* The any common objects and metods for the application "GoodFood"
*/
//'use strict' ;

function GetCodeOfNode(node) {
    var pos = node.indexOf(" : ");

    if (pos == -1) { pos = node.indexOf(" - ") };
    if (pos == -1) { return 'not node' }
    else return node.substr(0, pos)
};
function GetNameOfNode(node) {
    var pos = node.indexOf(" : ");

    if (pos == -1) { pos = node.indexOf(" - ") };
    if (pos == -1) { return 'not node' }
    else return node.substr(pos + 3)


};

module.exports = { GetCodeOfNode,GetNameOfNode };

 