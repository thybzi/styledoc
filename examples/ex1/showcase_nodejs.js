#!/usr/bin/env node

var styledoc = require('./../../styledoc');

styledoc.showcaseFile('css/main.css', {
    page_title: 'StyleDoc :: Example 1 :: FS/NodeJS showcase',
    presentation_padding: [ 0, 0, 4 ], // padding-bottom: 4px (button shadow maximum size)
    output_dir: 'showcase/nodejs/'
});