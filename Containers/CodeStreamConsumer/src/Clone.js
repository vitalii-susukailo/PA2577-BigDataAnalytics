class Clone {

    constructor(sourceName, targetName, sourceChunk, targetChunk) {
        this.sourceName = sourceName;
        this.sourceStart = sourceChunk[0].lineNumber;
        this.sourceEnd = sourceChunk[sourceChunk.length -1].lineNumber;
        this.sourceChunk = sourceChunk;
        this.targetChunk = targetChunk;   // ADDED: remember the matching lines in the other file

        this.targets = [{ name: targetName, startLine: targetChunk[0].lineNumber }];
    }

    equals(clone) {
        return this.sourceName == clone.sourceName &&
            this.sourceStart == clone.sourceStart &&
            this.sourceEnd == clone.sourceEnd;
    }

    addTarget(clone) {
        this.targets = this.targets.concat(clone.targets);
    }

    isNext(clone) {
        // CHANGED: the original version only checked the source lines.
        // Both the source and the target must continue where this clone ends,
        // otherwise a chunk that matches several places would be merged into the wrong clone
        // (e.g. B.java 4-10 was reported at A.java line 27 instead of 15).
        return (this.sourceChunk[this.sourceChunk.length-1].lineNumber == 
                clone.sourceChunk[clone.sourceChunk.length-2].lineNumber &&
                this.targets[0].name == clone.targets[0].name &&
                this.targetChunk[this.targetChunk.length-1].lineNumber ==
                clone.targetChunk[clone.targetChunk.length-2].lineNumber);
    }

    maybeExpandWith(clone) {
        if (this.isNext(clone)) {
            this.sourceChunk = [...new Set([...this.sourceChunk, ...clone.sourceChunk])];
            this.sourceEnd = this.sourceChunk[this.sourceChunk.length-1].lineNumber;
            this.targetChunk = [...new Set([...this.targetChunk, ...clone.targetChunk])];   // ADDED: expand the target lines too
            //console.log('Expanded clone, now starting at', this.sourceStart, 'and ending at', this.sourceEnd);
            return true;
        } else {
            return false;
        }
    }
}

module.exports = Clone;
