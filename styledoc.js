/**
 * StyleDoc
 * Parser and showcase generator for JavaDoc-like comments in CSS, LESS, SASS etc.
 *
 * @see https://github.com/thybzi/styledoc
 * @author Evgeni Dmitriev <thybzi@gmail.com>
 * @version 0.0.8
 * @requires jQuery 1.11.1+ or 2.1.1+,
 *     or jQuery 1.7.x+ with Sizzle tokenize() exposed: https://github.com/jquery/sizzle/issues/242
 * @requires mustache.js
 * Inspired with concept idea of https://github.com/Joony/styledoc/
 *
 * @todo revise list of supported tags
 * @todo more sophisticated applying of pseudo-class modifiers (instead of adding an attribute)?
 * @todo spaces in selectors (better than wrapping to {})
 * @todo enable multiple @example, applying to item best matching one
 * @todo parent and sibling selectors
 * @todo catch exceptions
 * @todo optimize code
 * @todo make more examples/demos
 * @todo write more tests
 * @todo hide methods that seem to be private?
 */
(function (root, factory) {

    if ((typeof define === "function") && define.amd) {
        // AMD
        define(["jquery", "mustache"], function ($, Mustache) {
            return factory(root, $, Mustache);
        });
    } else if ((typeof module !== "undefined") && module.exports) {
        // Node, CommonJS-like
        module.exports = factory(root, require("jquery"), require("mustache"));
    } else {
        // Browser globals (root is window)
        root.styledoc = factory(root, root.jQuery, root.Mustache);
    }

}(this, function (window, $, Mustache) {
    "use strict";

    var MODULE_VERSION = "0.0.8";

    var TEMPLATES_SUBDIR = "templates/";
    var LANGUAGE_SUBDIR = "language/";
    var PREVIEW_DIR = "preview/";

    var DEFAULT_PAGE_TITLE = "StyleDoc showcase";
    var DEFAULT_LANGUAGE = "en";
    var DEFAULT_DOCTYPE = "html5";
    var DEFAULT_TEMPLATE = "default";
    var DEFAULT_IFRAME_DELAY = 2000;
    var DEFAULT_OUTPUT_DIR = "showcase/";
    var DEFAULT_PHANTOMJS_VIEWPORT = "1280x800";

    var SECTION_ANCHOR_PREFIX = "section_";
    var ITEM_ANCHOR_PREFIX = "item_";


    var styledoc = {};

    styledoc.server_mode = !window.document; // @todo revise?
    styledoc.templates_dir = undefined; // defined few lines below
    styledoc.item_id_trim_underscores = true; // trim leading, heading and consecutive underscores in showcase item IDs
    styledoc.states_modify_unique_attrs = true; // modify "id" and "for" attr values to preserve their uniqueness when generating states
    styledoc.states_html_glue = "\n"; // @todo showcaseFile option?

    // Vars for npm modules (var declaration should be on top-level of the function)
    var jsdom,
        fs,
        path,
        request,
        chalk,
        phantom;
    if (styledoc.server_mode) {
        // Connect required npm modules
        jsdom = require("jsdom");
        fs = require("fs-extra");
        path = require("path");
        request = require("request");
        chalk = require("chalk");

        // Prepare virtual DOM for jQuery
        window = jsdom.jsdom().parentWindow;
        $ = $(window);

        // Check if phantom package is available
        try {
            phantom = require("phantom");
        } catch (e) {
            phantom = null;
        }

        // Set default template path for server mode
        styledoc.templates_dir = path.dirname(module.filename) + "/" + TEMPLATES_SUBDIR;
    } else {
        // Set default template path for browser mode
        styledoc.templates_dir = "js/styledoc/" + TEMPLATES_SUBDIR;
    }

    // tag_name: is_multiline // @todo set is_complex here
    styledoc.known_tags = {
        "$title":       false,  // block title
        "$description": true,   // block description
        "section":      false,  // (legacy?)
        "base":         false,  // base selector (e.g. .my-element)
        "modifier":     false,  // CSS-selector based modifier for element (e.g .my-subclass)
        "state":        false,  // a special kind of modifier, also added to each showcase item (e.g. :disabled or .active)
        "pseudo":       false,  // (legacy) in this version, just an alias of @state
        "example":      true,   // HTML to use in both code snippet and live preview
        "markup":       true,   // (legacy) alias of @example
        "presentation": true,   // (legacy) alias of @example
        "preview":      true,   // (legacy) alias of @example
        "author":       false,  // author of code block (multiple instances allowed)
        "version":      false,  // version of code block
        "since":        false,  // code version element exists since
        "deprecated":   false,  // beginning code version and/or reasons for element deprecating
        "see":          false,  // link to external resource (multiple instances allowed)
        "todo":         false,  // some matters to be improved within the code (multiple instances allowed)
        "fixme":        false   // some things needed to be fixed within the code (multiple instances allowed)
    };


    /**
     * Load and parse CSS file, creating showcase page
     * @param {string} url URL or relative path to root CSS file
     * @param {object} options
     * @param {string} [options.output_dir="showcase/"] Path to showcase page directory, relative to current location (FS mode only)
     * @param {string} [options.$container=$("body")] Root container for showcase in parent document (HTTP mode only)
     * @param {string} [options.template="default"] Name of showcase page template
     * @param {string} [options.language="en"] Language to apply when creating page
     * @param {string} [options.doctype="html5"] Target doctype
     * @param {string} [options.page_title="StyleDoc showcase"] Main title of showcase page (in HTTP mode document.title has priority)
     * @param {string} [options.css_url_http] HTTP(S) path to CSS file to use in preview (detected automatically by default) (FS mode only)
     * @param {number} [options.iframe_delay=2000] Delay (ms) before measuring iframe height
     * @param {boolean} [options.use_phantomjs=false] Use PhantomJS to pre-measure iframes height (FS mode only)
     * @param {string|object} [options.phantomjs_viewport="1280x800"] Viewport size for PhantomJS instances (FS mode only)
     * @param {object} [options.phantomjs_noweak=false] Disable "weak" module usage for PhantomJS instances (FS mode only)
     * @param {boolean} [options.silent_mode=false] Disable console messages (FS mode only)
     * @param {number|number[]} [options.preview_padding] Padding value(s) for preview container (4 or [4, 8], or [4, 0, 12, 8] etc.)
     * @param {string} [options.background_color] Background color CSS value for both main showcase page and preview iframe pages
     * @returns {JQueryPromise<void>}
     */
    styledoc.showcaseFile = function (url, options) {
        var dfd = $.Deferred();

        // Preprocess common options
        options = options || {};
        options.page_title = options.page_title || styledoc.getDefaultPageTitle();
        options.template = options.template || styledoc.getDefaultTemplate();
        options.language = options.language || styledoc.getDefaultLanguage();
        options.doctype = options.doctype || styledoc.getDefaultDoctype();
        options.iframe_delay = options.iframe_delay || styledoc.getDefaultIframeDelay();

        // Preprocess mode-specific options, display welcome message, etc.
        options = styledoc.getShowcaseFileInit()(url, options);

        // Load CSS file including all imports, prepare data and create showcase
        styledoc.loadFileRecursive(url).done(function (files_data) {
            var showcase_data = styledoc.prepareShowcaseData(styledoc.extractDocsData(files_data));
            var output = styledoc.getOutput();
            output(showcase_data, url, options).done(function () {
                dfd.resolve();
            }).fail(function (e) {
                dfd.reject(e);
            });
        }).fail(function (e) {
            dfd.reject(e);
        });

        return dfd.promise();
    };

    /**
     * Extract only styledocs data from loadFileRecursive result
     * @param {object} files_data
     * @returns {array}
     */
    styledoc.extractDocsData = function (files_data) {
        var result = [];
        for (var i = 0; i < files_data.length; i++) {
            result = result.concat(files_data[i].docs);
        }
        return result;
    };

    /**
     * Prepare data for CSS file showcase items from styledocs data
     * @param {array} docs_data
     * @returns {array}
     */
    styledoc.prepareShowcaseData = function (docs_data) {
        var result = [],
            used_section_anchors = [],
            used_item_ids = [];

        var i,
            j,
            parts,
            modifier,
            doc,
            selector,
            id,
            item_data,
            tag_data,
            tag_name,
            tag_content;
        for (i = 0; i < docs_data.length; i++) {

            doc = docs_data[i];
            id = i + 1;
            item_data = {
                id: id,
                section: null,
                anchor_name: SECTION_ANCHOR_PREFIX + id,
                title: null,
                description: null,
                base: null,
                base_description: null,
                example: null,
                version: null,
                author: [],
                since: null,
                is_deprecated: false,
                deprecated_info: null,
                see: [],
                todo: [],
                fixme: [],
                states: [],
                subitems: []
            };

            // Process item own properties
            for (j = 0; j < doc.tags.length; j++) {
                tag_data = doc.tags[j];
                tag_name = tag_data[0];
                tag_content = tag_data[1];
                switch (tag_name) {
                    case "$title":
                        item_data.title = tag_content;
                        break;
                    case "$description":
                        item_data.description = tag_content;
                        break;
                    case "section":
                        parts = parseComplexContent(tag_content); // @todo "is_complex" in tags config, use in parseTag
                        item_data.section = parts[0];
                        item_data.title = item_data.title || parts[1];
                        item_data.anchor_name = SECTION_ANCHOR_PREFIX + item_data.section;
                        break;
                    case "base":
                        parts = parseComplexContent(tag_content);
                        item_data.base = parts[0];
                        item_data.base_description = parts[1];
                        item_data.title = item_data.title || parts[1];
                        break;
                    case "example":
                    case "markup":
                    case "presentation":
                    case "preview":
                        item_data.example = item_data.example || tag_content; // @todo multiple examples
                        break;
                    case "version":
                    case "since":
                        item_data[tag_name] = tag_content;
                        break;
                    case "deprecated":
                        item_data.is_deprecated = true;
                        item_data.deprecated_info = tag_content;
                        break;
                    case "author":
                    case "see":
                    case "todo":
                    case "fixme":
                        item_data[tag_name].push(tag_content);
                        break;
                }
            }
            item_data.anchor_name = getUniqueSectionAnchor(item_data.anchor_name);

            // Process states
            for (j = 0; j < doc.tags.length; j++) {
                tag_data = doc.tags[j];
                tag_name = tag_data[0];
                tag_content = tag_data[1];
                switch (tag_name) {
                    case "state":
                    case "pseudo":
                        parts = parseComplexContent(tag_content);
                        item_data.states.push({
                            state: parts[0],
                            description: parts[1]
                        });
                        break;
                }
            }

            if (item_data.base) {

                // Create base showcase
                selector = item_data.base;
                id = getUniqueItemId(selector);
                item_data.subitems.push({
                    id: id,
                    anchor_name: ITEM_ANCHOR_PREFIX + id,
                    base: item_data.base,
                    modifier: null,
                    selector: selector,
                    description: item_data.base_description || "",
                    //example: styledoc.htmlApplyStates(item_data.example, item_data.base, item_data.states),
                    example: styledoc.htmlApplyModifier(item_data.example, item_data.base, "", item_data.states)
                });

                // Process subitems
                for (j = 0; j < doc.tags.length; j++) {
                    tag_data = doc.tags[j];
                    tag_name = tag_data[0];
                    tag_content = tag_data[1];
                    switch (tag_name) {
                        case "modifier":
                            parts = parseComplexContent(tag_content);
                            modifier = parts[0];
                            selector = item_data.base + modifier;
                            id = getUniqueItemId(selector);
                            item_data.subitems.push({
                                id: id,
                                anchor_name: ITEM_ANCHOR_PREFIX + id,
                                base: item_data.base,
                                modifier: modifier,
                                selector: selector,
                                description: parts[1],
                                example: styledoc.htmlApplyModifier(item_data.example, item_data.base, modifier, item_data.states)
                            });
                            break;
                    }
                }
            }

            result.push(item_data);
        }


        /**
         * Converts selector to ID and assures it is unique
         * @param {string} selector
         * @returns {string}
         * @todo dry?
         */
        function getUniqueItemId(selector) {

            var base_id = selectorToId(selector),
                id = base_id,
                numeric_suffix = 0;

            while (used_item_ids.indexOf(id) !== -1) {
                id = base_id + "_" + ++numeric_suffix;
            }

            used_item_ids.push(id);
            return id;
        }


        /**
         * Assures section anchor to be unique
         * @param {string} anchor
         * @returns {string}
         * @todo dry?
         */
        function getUniqueSectionAnchor(anchor) {

            var base_anchor = anchor,
                numeric_suffix = 0;

            while (used_section_anchors.indexOf(anchor) !== -1) {
                anchor = base_anchor + "_" + ++numeric_suffix;
            }

            used_section_anchors.push(anchor);
            return anchor;
        }


        function parseComplexContent(content) {
            var mask_braces = /^\{([^\{\}]+)\}(\s+(\S[\S\s]*))?$/;
            var mask_no_braces = /^(\S+)(\s+(\S[\S\s]*))?$/;
            var mask = mask_braces.test(content) ? mask_braces : mask_no_braces; // @todo improve
            var matches = content.match(mask);
            return matches ? [ matches[1], matches[3] ] : [ undefined, undefined ];
        }

        function sortBySection(a, b) {
            if (a.section < b.section) {
                return -1;
            } else if (a.section > b.section) {
                return 1;
            } else {
                return 0;
            }
        }


        result.sort(sortBySection);
        return result;
    };


    /**
     * Append state variants after base element HTML markup
     * @param {string} html Input HTML markup
     * @param {string} base CSS selector for base element
     * @param {array} states List containing CSS selectors for states
     * @returns {string}
     */
    styledoc.htmlApplyStates = function (html, base, states) {
        if (isArray(states) && states.length) {
            var html_base = html,
                result;
            for (var i = 0; i < states.length; i++) {
                result = styledoc.htmlApplyModifier(html_base, base, states[i].state, undefined, styledoc.states_modify_unique_attrs);
                if (result) {
                    html += styledoc.states_html_glue + result;
                }
            }
        }

        return html;
    };

    /**
     * Modify base element HTML markup by CSS selector
     * @param {string} html Input HTML markup
     * @param {string} base CSS selector for base element
     * @param {string} modifier CSS selector to modify base element
     * @param {array} states List containing CSS selectors for states
     * @param {boolean} modify_unique_attrs Add suffix to any "id" or "for" attr value found within the code
     * @returns {string}
     */
    styledoc.htmlApplyModifier = function (html, base, modifier, states, modify_unique_attrs) {
        var $wrapper = $("<styledoc-wrapper>").append(html); // @todo hardcode tag name
        var $elem = $(base, $wrapper);

        // Basic modify
        var modify_by_selector = modifier && $elem.length;
        if (modify_by_selector) {
            var parsed = $.find.tokenize(modifier).pop();
            var item,
                attr_name,
                attr_value,
                replace_class;
            for (var i = 0; i < parsed.length; i++) {
                item = parsed[i];
                attr_name = null;
                attr_value = "";
                replace_class = false;
                switch (item.type) {
                    case "ID":
                        attr_name = "id";
                        attr_value = item.matches[0];
                        break;
                    case "CLASS":
                        attr_name = "class";
                        attr_value = item.matches[0];
                        break;
                    case "ATTR":
                        attr_name = item.matches[0];
                        attr_value = item.matches[2];
                        break;
                    case "PSEUDO":
                        attr_name = item.matches[0];
                        break;
                    case "TAG":
                        attr_name = ($elem.attr('class')) ? "class" : "";
                        attr_value = ($elem.attr('class')) ? $elem.attr('class') + item.matches[0] : "";
                        replace_class = ($elem.attr('class')) ? true : false;
                        break;
                }
                if (attr_name === "class" && !replace_class) {
                    $elem.addClass(attr_value);
                } else if (attr_name) {
                    $elem.attr(attr_name, attr_value);
                }
            }
        }

        // Modify "id" and "for" attribute values for any child elements (if enabled)
        if (modify_unique_attrs) {
            // @todo assure real uniqueness
            // @todo bad luck when base/modifier contain id selector (and possibly have elems with "for")
            var suffix = "_" + selectorToId(modifier);
            $.each([ "id", "for" ], function (i, attr_name) {
                $("[" + attr_name + "]", $wrapper).each(function (j, elem) {
                    var $elem = $(elem);
                    var attr_value = $elem.attr(attr_name);
                    $elem.attr(attr_name, attr_value + suffix)
                });
            });
        }

        // If input HTML has been modified, saving these modifications
        if (modify_by_selector || modify_unique_attrs) {
            html = $wrapper.html();
        }

        // Post-process with custom modifier if exists
        if (typeof styledoc.htmlApplyModifierCustom === "function") {
            var result = styledoc.htmlApplyModifierCustom(html, base, modifier, $wrapper, $elem);
            if (typeof result === "string") {
                html = result;
            }
        }

        // Apply states
        html = styledoc.htmlApplyStates(html, base, states);


        return html;
    };

    styledoc.htmlApplyModifierCustom = null; // @todo find a better way to modify example content?





    /**
     * Preprocess some options and display welcome message
     * @param {string} css_url URL to CSS file (relative to current location)
     * @param {object} options
     * @param {string} [options.output_dir="showcase/"] Path to showcase page directory (relative to current location)
     * @param {boolean} [options.silent_mode=false] Disable console messages
     */
    styledoc.showcaseFileInitFs = function (css_url, options) {
        var silent_mode = options.silent_mode = !!options.silent_mode;
        var output_dir = options.output_dir || styledoc.getDefaultOutputDir();
        options.output_dir = output_dir = ensureTrailingSlash(output_dir);

        if (!silent_mode) {
            console.log(chalk.yellow("\nStyleDoc v" + styledoc.getModuleVersion()));
            console.log("Source CSS file:  " + chalk.yellow(css_url));
            console.log("Target directory: " + chalk.yellow(output_dir));
            console.log("\nLoading source CSS...");
        }

        return options;
    };

    /**
     * In future, may preprocess some options and display welcome message
     * @param {string} css_url URL to CSS file (relative to current location)
     * @param {object} options
     */
    styledoc.showcaseFileInitHttp = function (css_url, options) {
        return options;
    };


    /**
     * Create showcase page from data provided (HTTP/browser mode)
     * @param {object} showcase_data Showcase data to be output
     * @param {string} css_url URL to CSS file (relative to showcase page or absolute)
     * @param {object} options Some options are already preprocessed in previous methods
     * @param {string} options.template Name of showcase page template
     * @param {string} options.language Language to apply when creating page
     * @param {string} options.doctype Target doctype
     * @param {string} [options.$container=$("body")] Root container for showcase in parent document
     * @param {string} options.page_title Main title of showcase page
     * @param {number} options.iframe_delay Delay (ms) before measuring iframe height
     * @param {number|number[]} [options.preview_padding] Padding value(s) for preview container (4 or [4, 8], or [4, 0, 12, 8] etc.)
     * @param {string} [options.background_color] Background color CSS value for both main showcase page and preview iframe pages
     * @returns {JQueryPromise<void>}
     */
    styledoc.outputHttp = function (showcase_data, css_url, options) {

        var dfd = $.Deferred();

        var $container = options.$container || $("body");
        var page_title = options.page_title;
        var language = options.language;
        var doctype = options.doctype;
        var iframe_delay = options.iframe_delay;

        var template_name = options.template;
        var template_dir = styledoc.templates_dir + template_name + "/";

        var css_url_preview;
        if (isAbsolutePath(css_url)) {
            css_url_preview = css_url;
        } else {
            css_url_preview = "//" + document.location.host + dirPath(document.location.pathname) + css_url;
        }

        var preview_container_style = getPreviewContainerStyle(options);

        $("head").append('<link rel="stylesheet" href="' + template_dir + 'main.css">');

        if (options.background_color) {
            $("body").css("background-color", options.background_color);
        }

        var loadFile = styledoc.getLoader().loadFile;
        var load_main_template = loadFile(template_dir + "main.mustache"); // @todo doctype?
        var load_lang = loadFile(template_dir + LANGUAGE_SUBDIR + language + ".json", true);

        $.when(load_main_template, load_lang).done(
            function (main_template_jqdata, lang_data_jqdata) {
                var main_template = main_template_jqdata[0];
                var lang_data = lang_data_jqdata[0];
                var main_content = Mustache.render(main_template, {
                    page_title: page_title,
                    lang: lang_data,
                    css_url: css_url_preview,
                    iframe_url: template_dir + PREVIEW_DIR + doctype + ".html",
                    items: showcase_data,
                    presenter: displayPreview
                });
                $container.append(main_content).trigger("complete");
                dfd.resolve();
            }
        ).fail(function (e) {
            dfd.reject(e);
        });

        /**
         * Remove all after the last slash in path
         * @param {string} path
         * @returns {string}
         */
        function dirPath(path) {
            return path.replace(/\/[^\/]*$/, "/");
        }

        function resizeIframe($iframe) {
            var iframe_body = $iframe.contents().find("body")[0];
            $iframe.height(iframe_body.offsetHeight);
            $iframe.removeClass("loading"); // @todo hardcode class
        }

        // @todo optimize (this code vs. index.mustache code)
        function displayPreview() {
            var data = this;
            $container.on("complete", function () {
                var $iframe = $("iframe#preview_" + data.id);
                if ($iframe.length) {
                    $iframe.load(function () {
                        var $contents = $iframe.contents();
                        $contents.find("head").append('<link rel="stylesheet" href="' + css_url_preview + '">');
                        $contents.find("#styledoc-container") // @todo hardcode id
                            .append(data.example)
                            .attr("style", preview_container_style);
                        var resizer = function () {
                            resizeIframe($iframe);
                        };
                        setTimeout(function () {
                            resizer();
                            $(window).resize(resizer);
                        }, iframe_delay);

                    });
                }
            });
        }

        return dfd.promise();
    };

    /**
     * Create showcase page from data provided (Filesystem/NodeJS mode)
     * @param {object} showcase_data Showcase data to be output
     * @param {string} css_url URL to CSS file (relative to current location)
     * @param {object} options Some options are already preprocessed in previous methods
     * @param {string} options.template Name of showcase page template
     * @param {string} options.language Language to apply when creating page
     * @param {string} options.doctype Target doctype
     * @param {string} options.page_title Main title of showcase page
     * @param {string} options.output_dir Path to showcase page directory (relative to current location)
     * @param {string} [options.css_url_http] HTTP(S) path to CSS file to use in preview (detected automatically by default) (FS mode only)
     * @param {number} options.iframe_delay Delay (ms) before measuring iframe height
     * @param {boolean} [options.use_phantomjs=false] Use PhantomJS to pre-measure iframes height (FS mode only)
     * @param {string|object} [options.phantomjs_viewport="1280x800"] Viewport size for PhantomJS instances (FS mode only)
     * @param {object} [options.phantomjs_noweak=false] Disable "weak" module usage for PhantomJS instances (FS mode only)
     * @param {boolean} options.silent_mode Disable console messages
     * @param {number|number[]} [options.preview_padding] Padding value(s) for preview container (4 or [4, 8], or [4, 0, 12, 8] etc.)
     * @param {string} [options.background_color] Background color CSS value for both main showcase page and preview iframe pages
     * @returns {JQueryPromise<void>}
     */
    styledoc.outputFs = function (showcase_data, css_url, options) {

        var dfd = $.Deferred();
        var silent_mode = options.silent_mode;


        if (!silent_mode) {
            console.log("Source CSS loaded");
        }

        // Counting subitems to display
        var items_count = showcase_data.length,
            subitems_count = 0,
            previews_count = 0,
            previews_dfd = $.Deferred(),
            i,
            j,
            subitem_data,
            file_name,
            file_path,
            file_path_relative,
            preview_content;
        for (i = 0; i < items_count; i++) {
            subitems_count += showcase_data[i].subitems.length;
        }

        // If no subitems found, exiting immediately
        if (!subitems_count) {
            if (!silent_mode) {
                console.log(chalk.red("\nNo showcase data found in CSS, exiting\n"));
            }
            dfd.resolve(); // or reject?
            return dfd.promise();
        }



        var page_title = options.page_title;
        var language = options.language;
        var doctype = options.doctype;
        var iframe_delay = options.iframe_delay;

        var use_phantomjs_requested = !!options.use_phantomjs;
        var use_phantomjs_available = !!phantom;
        var use_phantomjs = use_phantomjs_requested && use_phantomjs_available;
        var phantomjs_viewport = convertViewportValue(options.phantomjs_viewport || styledoc.getDefaultPhantomjsViewport());
        var phantomjs_noweak = !!options.phantomjs_noweak;

        var output_dir = options.output_dir;
        var preview_dir = output_dir + PREVIEW_DIR;
        var template_name = options.template;
        var template_dir = styledoc.templates_dir + template_name + "/";

        var realpath = ensureTrailingSlash(fs.realpathSync("./"));
        var css_url_preview;
        if (isString(options.css_url_http)) {
            css_url_preview = options.css_url_http;
        } else if (isAbsolutePath(css_url)) {
            css_url_preview = css_url;
        } else {
            css_url_preview = path.relative(realpath + preview_dir, realpath + css_url);
            css_url_preview = css_url_preview.replace(/\\/g, "/"); // avoid backslashes on Windows
        }

        var preview_container_style = getPreviewContainerStyle(options);
        var background_color = options.background_color;


        if (!silent_mode) {
            console.log("\nLoading resources...");
        }

        var loadFile = styledoc.getLoader().loadFile;
        // @todo optimize (something better than: force_fs = true)
        var load_index_template = loadFile(template_dir + "index.mustache", false, true);
        var load_main_template = loadFile(template_dir + "main.mustache", false, true); // @todo doctype?
        var load_preview_template = loadFile(template_dir + PREVIEW_DIR + doctype + ".mustache", false, true);
        var load_lang = loadFile(template_dir + LANGUAGE_SUBDIR + language + ".json", true, true);

        var mkdirs = mkdirp(preview_dir);
        var copy_main_css = copy(template_dir + "main.css", output_dir + "main.css");
        var copy_preview_css = copy(template_dir + "preview.css", output_dir + "preview.css");

        $.when(load_index_template, load_main_template, load_preview_template, load_lang, mkdirs, copy_main_css, copy_preview_css).done(
            function (index_template, main_template, preview_template, lang_data) {

                if (!silent_mode) {
                    console.log("All resources loaded");
                }

                var items_count = showcase_data.length,
                    subitems_count = 0,
                    previews_count = 0,
                    previews_dfd = $.Deferred(),
                    i,
                    j,
                    subitem_data,
                    file_name,
                    file_path,
                    file_path_relative,
                    preview_content;
                for (i = 0; i < items_count; i++) {
                    subitems_count += showcase_data[i].subitems.length;
                }

                if (!silent_mode) {
                    console.log("\nCreating preview files (" + subitems_count + " total)");
                }

                for (i = 0; i < items_count; i++) {
                    for (j = 0; j < showcase_data[i].subitems.length; j++) {
                        subitem_data = showcase_data[i].subitems[j];
                        file_name = subitem_data.id + ".html";
                        file_path = preview_dir + file_name;
                        file_path_relative = PREVIEW_DIR + file_name;
                        preview_content = Mustache.render(preview_template, {
                            css_url: css_url_preview,
                            container_style: preview_container_style,
                            content: subitem_data.example
                        });
                        subitem_data.iframe_url = file_path_relative; // @todo use separate var without changing showcase_data?
                        (function (file_path, preview_content, subitem_data) {
                            fs.writeFile(
                                file_path,
                                preview_content,
                                function () {

                                    if (!silent_mode) {
                                        console.log(chalk.cyan("[CREATE] " + file_path));
                                    }

                                    // iframe delay mode
                                    if (!use_phantomjs) {
                                        countPreviewItem();
                                        return;
                                    }

                                    // PhantomJS mode
                                    phantom.create(function (ph) {
                                        ph.createPage(function (page) {
                                            page.set("viewportSize", phantomjs_viewport);

                                            /**
                                             * Only absolute paths work when opening local file in PhantomJS
                                             * @see https://github.com/ariya/phantomjs/issues/10330
                                             */
                                            page.open(fs.realpathSync(file_path), function (status) {
                                                if (status !== "success") { // @todo also raise .fail()?
                                                    ph.exit(); // @todo is it needed?
                                                    throw new Error("Error opening " + file_path + ":\n\n" + status);
                                                }

                                                page.evaluate(
                                                    function () {
                                                        return document.body.offsetHeight;
                                                    },
                                                    function (body_height) {
                                                        subitem_data.iframe_height = body_height; // @todo use separate var without changing showcase_data?

                                                        if (!silent_mode) {
                                                            console.log(chalk.gray("[HEIGHT] " + file_path));
                                                        }

                                                        countPreviewItem();
                                                        ph.exit();
                                                    }
                                                );
                                            });

                                        });
                                    }, {
                                        /** @see https://github.com/sgentle/phantomjs-node#use-it-in-windows */
                                        dnodeOpts: {
                                            weak: !phantomjs_noweak
                                        }
                                    });
                                }
                            );
                        })(file_path, preview_content, subitem_data);
                    }
                }

                function countPreviewItem() {
                    if (++previews_count === subitems_count) {
                        previews_dfd.resolve();
                    }
                }

                previews_dfd.done(function () {

                    if (!silent_mode) {

                        if (use_phantomjs_requested && !use_phantomjs_available) {
                            console.log(chalk.red('Warning: "use_phantomjs" option ignored, because "phantom" package is not installed'));
                        }

                        console.log("All preview files created");
                    }

                    var main_content = Mustache.render(main_template, {
                        page_title: page_title,
                        lang: lang_data,
                        css_url: css_url,
                        items: showcase_data,
                        iframe_use_onload: !use_phantomjs // @todo unify with http mode
                    });

                    if (!silent_mode) {
                        console.log("\nCreating index file...");
                    }

                    fs.writeFile(
                        output_dir + "index.html",
                        Mustache.render(index_template, {
                            page_title: page_title,
                            background_color: background_color,
                            content: main_content,
                            iframe_use_onload: !use_phantomjs, // @todo unify with http mode
                            iframe_delay: iframe_delay // @todo unify with http mode
                        }),
                        function () {
                            if (!silent_mode) {
                                console.log(chalk.cyan("[CREATE] " + output_dir + "index.html"));
                                console.log("Index file created");
                                console.log(chalk.green("\nAll done!\n"));
                            }
                            dfd.resolve();
                        }
                    );
                });

            }
        ).fail(function (e) {
            dfd.reject(e);
        });

        /**
         * Convert "WIDTHxHEIGHT" string input to { width: WIDTH, height: HEIGHT }
         * Validate and normalize any object input
         * Returns undefined for any bad (unconvertable) input
         * @param {string|object} value
         * @returns {{ width: {number}, height: {number} } | undefined}
         */
        function convertViewportValue(value) {
            var mask = /^(\d+)x(\d+)$/,
                matches;
            if (isString(value) && mask.test(value)) {
                matches = value.match(mask);
                return {
                    width: toInteger(matches[1]),
                    height: toInteger(matches[2])
                };
            } else if (isRegularObject(value) &&
                value.hasOwnProperty("width") && (value.width >= 1) &&
                value.hasOwnProperty("height") && (value.height >= 1)
            ) {
                return {
                    width: toInteger(value.width),
                    height: toInteger(value.height)
                };
            } else {
                return undefined;
            }
        }

        function mkdirp(path) {
            var dfd = $.Deferred();
            fs.mkdirs(path, function (error) {
                if (error) { // @todo also raise .fail()?
                    throw new Error("Error loading " + url + ":\n\n" + error);
                }
                dfd.resolve();
            });
            return dfd.promise();
        };

        function copy(src, dest) {
            var dfd = $.Deferred();
            fs.copy(src, dest, function (error) {
                if (error) { // @todo also raise .fail()?
                    throw new Error("Error loading " + url + ":\n\n" + error);
                }
                dfd.resolve();
            });
            return dfd.promise();
        };

        return dfd.promise();
    };


    /**
     * File loading transport interface for HTTP/browser mode
     */
    styledoc.loaderHttp = {
        /**
         * @param {string} url
         * @param {boolean} [is_json=false]
         * @returns {JQueryPromise<string|object>}
         */
        loadFile: function(url, is_json) {
            return $.ajax({
                url: url,
                dataType: is_json ? "json" : "text",
                error: function(jqXHR, textStatus, errorThrown) { // @todo catch
                    throw new Error("Error loading " + url + ":\n\n" + errorThrown);
                }
            });
        }
    };

    /**
     * File loading transport interface for Filesystem/NodeJS mode
     */
    styledoc.loaderFs = {
        /**
         * @param {string} url
         * @param {boolean} [is_json=false]
         * @param {boolean} [force_fs=false]
         * @returns {JQueryPromise<string|object>}
         */
        loadFile: function(url, is_json, force_fs) {
            var dfd = $.Deferred();

            // @todo optimize
            if (isAbsolutePath(url) && !force_fs) { // @todo isHttpPath? or enable user option (force_fs/force_http) when calling showcase generator
                request(url, function (error, response, content) {
                    if (error || response.statusCode !== 200) {
                        throw new Error("Error loading (request) " + url + ":\n\n" + (error || response.statusCode)); // @todo also raise .fail()?
                    }
                    dfd.resolve(is_json ? JSON.parse(content) : content);
                });
            } else {
                fs.readFile(url, { encoding: "utf-8" }, function (error, content) { // @todo absolute path
                    if (error) {
                        throw new Error("Error loading (fs) " + url + ":\n\n" + error); // @todo also raise .fail()?
                    }
                    dfd.resolve(is_json ? JSON.parse(content) : content);
                });
            }

            return dfd.promise();
        }
    };

    /**
     * Load CSS file content including all imports (recursively)
     * Also collects all styledoc data from these files
     * @param {string} url Root CSS file URL or relative path
     * @param {string} [parent_url] Parent CSS file URL or relative path (if any)
     * @param {array} [result] Array to append parsing results to
     * @returns {array} Data describing files loaded and styledocs extracted from them
     */
    styledoc.loadFileRecursive = function (url, parent_url, result) {
        var dfd = $.Deferred();
        result = result || [];

        var loadFile = styledoc.getLoader().loadFile;
        loadFile(url).done(
            function (content) {
                var content_parsed = styledoc.parseFileContent(content, url),
                    imports = content_parsed.imports,
                    imports_promises;
                result.push({
                    url: url,
                    parent_url: parent_url,
                    content: content,
                    imports: content_parsed.imports,
                    docs: content_parsed.docs
                });

                var i;
                if (imports) {
                    imports_promises = [];
                    for (i = 0; i < imports.length; i++) {
                        imports_promises.push(styledoc.loadFileRecursive(imports[i].url, url, result));
                    }
                    $.when.apply($, imports_promises).done(
                        function () {
                            dfd.resolve(result);
                        }
                    ).fail(
                        function () {
                            dfd.reject();
                        }
                    );
                } else {
                    dfd.resolve(result);
                }
            }
        ).fail(
            function () {
                dfd.reject();
            }
        );

        return dfd.promise();
    };

    /**
     * Parse CSS file content, extracting imports and styledocs
     * @param {string} file_content
     * @param {string} file_url
     * @returns {{ imports: array, docs: array }}
     */
    styledoc.parseFileContent = function (file_content, file_url) {
        var result = {
            imports: [],
            docs: []
        };

        var file_base_path,
            file_base_path_mask;
        if (file_url) {
            file_base_path_mask = /^(\S+\/)?[^\/]*$/;
            file_base_path = file_url.replace(file_base_path_mask, "$1");
        }

        var import_mask = /@import\s+(url\()?['"]?([^'"\)]+)['"]?(\))?(\s|;|$)/;
        var imports = file_content.match(new RegExp(import_mask.source, "g")) || [];

        if (imports.length) {
            var import_path;
            for (var i = 0; i < imports.length; i++) {
                import_path = imports[i].replace(import_mask, "$2");

                result.imports.push({
                    path: import_path,
                    url: isAbsolutePath(import_path) ? import_path : (file_base_path + import_path)
                });
            }
        }

        var doc_mask = /\/\*[\*\!]\s+[\S\s]+?\s+\*\//g; // @todo dry masks (see parseDoc)
        var docs = file_content.match(doc_mask) || [];

        var doc_content,
            doc_tags;
        if (docs.length) {
            for (i = 0; i < docs.length; i++) {
                doc_content = styledoc.normalizeDoc(docs[i]);
                doc_tags = styledoc.parseDoc(doc_content);
                result.docs.push({
                    content: doc_content,
                    tags: doc_tags
                });
            }
        }


        return result;
    };


    /**
     * Normalizes styledoc content, transforming EOLs to Unix-style and removing extra indent
     * @param {string} doc_content
     * @returns {string}
     */
    styledoc.normalizeDoc = function (doc_content) {
        // Convert line-endings to Unix-style
        doc_content = doc_content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        // Wipe leading whitespaces, though leave a single space (for all lines but first)
        doc_content = doc_content.replace(/^\s+/mg, " ").replace(/^ /, "");

        return doc_content;
    };


    /**
     * Parses styledoc content, extracting tags and their values
     */
    styledoc.parseDoc = function (doc_content) {
        var result = [];
        var lines = doc_content.split("\n");

        function initTag(tag_name, tag_content) {
            // Apply default values for params omitted
            tag_name = (tag_name !== undefined) ? tag_name : null;
            tag_content = (tag_content !== undefined) ? tag_content : "";

            // Determine whether tag is known
            if (styledoc.known_tags[tag_name] !== undefined) {
                // Determine whether tag is multiline
                var is_multiline = styledoc.known_tags[tag_name];
                // Determine, save and wipe off global indent for multiline tag
                var indent = null;
                if (is_multiline) {
                    indent = getLineIndent(tag_content);
                    if (indent) {
                        tag_content = tag_content.replace(indent, "");
                    }
                }
                // Initialize new tag
                current_tag = {
                    name: tag_name,
                    content: tag_content,
                    is_multiline: is_multiline,
                    indent: indent
                };
            } else {
                // Tag unknown
                current_tag = null;
            }
        }

        function getLineIndent(content) {
            var indent = null;
            if (content.length) {
                var indent_match = content.match(/^(\s*)/);
                indent = new RegExp("^" + indent_match[1]);
            }
            return indent;
        }

        function appendTagContent(content) {
            if (current_tag) {
                // Get line indent if it wasn"t detected before
                if (!current_tag.indent && content.length) {
                    current_tag.indent = getLineIndent(content);
                }
                // Wipe off line indent from content
                if (current_tag.indent) {
                    content = content.replace(current_tag.indent, "");
                }
                // Append content with preceding line-break
                current_tag.content += "\n" + content;
            }
        }

        function completeCurrentTag(new_tag_name, new_tag_content) {
            // Apply default values for params omitted
            new_tag_name = (new_tag_name !== undefined) ? new_tag_name : null;
            new_tag_content = (new_tag_content !== undefined) ? new_tag_content : "";

            // Save current tag (if there is any)
            if (current_tag) {
                // Trim leading and trailing line-endings
                current_tag.content = current_tag.content.replace(/^\n*/, "").replace(/\n*$/, "");
                // Don"t save meta-tag ($title or $description) if content is empty
                var is_meta_tag = (current_tag.name.indexOf("$") === 0);
                if (!is_meta_tag || current_tag.content.length) {
                    // Otherwise, save tag name and content
                    result.push([ current_tag.name, current_tag.content ]);
                }
            }

            // Initialize appropriate new tag
            if (new_tag_name) {
                initTag(new_tag_name, new_tag_content);
            } else {
                initTag();
            }
        }

        // Regexp masks for tag name/value and line begin/end
        var doc_begin_mask = /^\/\*[\*\!]\s?/; // @todo dry masks (see parseFileContent)
        var line_begin_mask = /^ \*\s?/;
        var end_mask = /\s*(\*\/)?\s*$/;
        var tag_mask = /^\s*@([a-z0-9_-]+)(\s+(.+))?/i;

        // Variable for current tag data
        var current_tag;

        // Begin with title tag
        initTag("$title");

        var begin_mask,
            line_content,
            tag_match;
        for (var i = 0; i < lines.length; i++) {
            begin_mask = i ? line_begin_mask : doc_begin_mask;
            line_content = lines[i].replace(end_mask, "").replace(begin_mask, "");
            tag_match = line_content.match(tag_mask);
            if (tag_match) {
                // If new tag begin found, finish current tag and init a new one
                completeCurrentTag(tag_match[1], tag_match[3] || "");
            } else if (current_tag) {
                // If no new tag found
                if (current_tag.name === "$title") {
                    // If we process $title and current line has content, complete tag with this content
                    if (line_content.length) {
                        current_tag.content = line_content;
                        completeCurrentTag("$description");
                    }
                } else if (current_tag.is_multiline) {
                    // If current tag is multiline, append line content to its content
                    appendTagContent(line_content);
                } else {
                    // Otherwise, just finish current tag
                    completeCurrentTag();
                }
            }
        }
        // Finish current tag if it is unfinished
        completeCurrentTag();

        return result;
    };



    /**
     * @param value
     * @returns {number}
     */
    function toInteger(value) {
        return parseInt(value, 10);
    }

    /**
     * @param value
     * @returns {boolean}
     */
    function isString(value) {
        return (typeof value === "string");
    }

    /**
     * @param value
     * @returns {boolean}
     */
    function isArray(value) {
        return value && (value instanceof Array);
    }

    /**
     * Is input value an object of {} kind
     * @param value
     * @returns {boolean}
     */
    function isRegularObject(value) {
        return (typeof value === "object") && !!value && !isArray(value);
    }

    /**
     * @param {string} path
     * @returns {boolean}
     */
    function isAbsolutePath(path) {
        var mask = /^(\/|[a-z]+:)/; // @todo what about /home/myuser/myfile.css?
        return !!path.match(mask);
    }

    /**
     * @param {string} path
     * @returns {string}
     */
    function ensureTrailingSlash(path) {
        return path.replace(/\/$/, "") + "/";
    }

    /**
     * Generate value for the preview container "style" attribute
     * @param {object} options
     * @param {number|number[]} [options.preview_padding] Padding value(s) for preview container (4 or [4, 8], or [4, 0, 12, 8] etc.)
     * @param {string} [options.background_color] Background color CSS value for both main showcase page and preview iframe pages
     * @returns {string|undefined} Undefined value denies redundant attribute creating: $elem.attr("style", undefined)
     * @todo enable string value for preview_padding (like "4px 8px")?
     */
    function getPreviewContainerStyle(options) {
        var preview_container_style = "";

        var padding_value = options.preview_padding;
        if (typeof padding_value === "number") {
            padding_value = [ padding_value ];
        }
        if (isArray(padding_value)) {
            preview_container_style += "padding: " + padding_value.join("px ") + "px !important; ";
        }

        if (options.background_color) {
            preview_container_style += "background-color: " + options.background_color + " !important; ";
        }

        return preview_container_style.replace(/\s$/, "") || undefined;
    }


    /**
     * Replace any char other than latin letters, digits, hyphens and underscores with underscore char
     * Also wipes out the first underscore char (@todo is it really good and safe idea?)
     * E.g.: .my-class => my-class
     *       .my-class.subclass#id #otherid => my-class_subclass_id__otherid
     * @param {string} selector
     * @returns {string}
     */
    function selectorToId(selector) {
        var id = selector.replace(/[^a-z0-9_-]/ig, "_");

        if (styledoc.item_id_trim_underscores) {
            id = id.replace(/_{2,}/g, "_").replace(/^_/, "").replace(/_$/, "");
        }

        return id;
    }


    // @todo improve naming and structure
    styledoc.getShowcaseFileInit = function () {
        return styledoc.server_mode ? styledoc.showcaseFileInitFs : styledoc.showcaseFileInitHttp;
    };

    styledoc.getLoader = function () {
        return styledoc.server_mode ? styledoc.loaderFs : styledoc.loaderHttp;
    };

    styledoc.getOutput = function () {
        return styledoc.server_mode ? styledoc.outputFs : styledoc.outputHttp;
    };


    /** @returns {string} */
    styledoc.getModuleVersion = function () {
        return MODULE_VERSION;
    };

    /** @returns {string} */
    styledoc.getDefaultLanguage = function () {
        return DEFAULT_LANGUAGE;
    };

    /** @returns {string} */
    styledoc.getDefaultDoctype = function () {
        return DEFAULT_DOCTYPE;
    };

    /** @returns {string} */
    styledoc.getDefaultTemplate = function () {
        return DEFAULT_TEMPLATE;
    };

    /** @returns {number} */
    styledoc.getDefaultIframeDelay = function () {
        return DEFAULT_IFRAME_DELAY;
    };

    /** @returns {string} */
    styledoc.getDefaultOutputDir = function () {
        return DEFAULT_OUTPUT_DIR;
    };

    /** @returns {string} */
    styledoc.getDefaultPhantomjsViewport = function () {
        return DEFAULT_PHANTOMJS_VIEWPORT;
    };

    /** @returns {string} */
    styledoc.getDefaultPageTitle = function () {
        if (!styledoc.server_mode && isString(document.title) && document.title.length) {
            return document.title;
        } else {
            return DEFAULT_PAGE_TITLE;
        }
    };



    return styledoc;
}));
