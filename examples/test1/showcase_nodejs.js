#!/usr/bin/env node

var styledoc = require('./../../styledoc');

styledoc.showcaseFile('css/main.css', {
    page_title: 'StyleDoc :: Example 1 :: FS/NodeJS showcase',
    presentation_pad_bottom: 4, // maximum shadow offset for buttons
    output_dir: 'showcase/nodejs/'
});
