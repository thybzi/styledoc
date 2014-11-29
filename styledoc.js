/**
 * StyleDoc
 * Parser and showcase generator for JavaDoc-like comments in CSS, LESS, SASS etc.
 *
 * @see https://github.com/thybzi/styledoc
 * @author Evgeni Dmitriev <thybzi@gmail.com>
 * @version 0.0.2
 * @requires jQuery 1.11.1+ or 2.1.1+,
 *     or jQuery 1.7.x+ with Sizzle tokenize() exposed: https://github.com/jquery/sizzle/issues/242
 * @requires mustache.js
 * Inspired with concept idea of https://github.com/Joony/styledoc/
 *
 * @todo separate template and skin?
 * @todo revise list of supported tags
 * @todo more sophisticated applying of pseudo-class modifiers (instead of adding an attribute)?
 * @todo spaces in selectors (better than wrapping to {})
 * @todo something better than using htmlApplyModifierCustom
 * @todo @item, @item-state, @item-modifier?
 * @todo HTML markup modifiers completely denying auto-modifying?
 * @todo better console messages
 * @todo grunt module
 * @todo customizable ID (html anchor) giving scheme (e.g. #button vs .button)
 * @todo catch exceptions
 * @todo optimize code
 * @todo make examples/demos
 * @todo write more tests
 * @todo alternative for newly-modified jQuery Sizzle?
 * @todo get rid of heavy dependencies?
 * @todo actualize dependencies versions
 * @todo hide methods that seem to be private?
 */
(function (root, factory) {

    if ((typeof define === "function") && define.amd) {
        // AMD
        define(["jquery", "mustache"], function ($, Mustache) {
            factory(root, $, Mustache);
        });
    } else if ((typeof module !== "undefined") && module.exports) {
        // Node, CommonJS-like
        module.exports = factory(root, require("jquery"), require("mustache"), require("jsdom"), require("phantom"), require("fs-extra"), require("path"), require("request"), require("chalk"));
    } else {
        // Browser globals (root is window)
        root.styledoc = factory(root, root.jQuery, root.Mustache);
    }

}(this, function (window, $, Mustache, jsdom, phantom, fs, path, request, chalk) {
    "use strict";

    var MODULE_VERSION = "0.0.2";

    var DEFAULT_LANGUAGE = "en";
    var DEFAULT_DOCTYPE = "html5";
    var DEFAULT_TEMPLATE = "default";
    var DEFAULT_IFRAME_DELAY = 2000;
    var DEFAULT_OUTPUT_DIR = "showcase/";

    var LANGUAGE_SUBDIR = "language/";
    var PRESENTATION_SUBDIR = "presentation/";


    var styledoc = {};

    styledoc.server_mode = !window.document; // @todo revise?
    styledoc.templates_dir = undefined; // defined few lines below
    styledoc.use_selector_based_ids = true; // use selector-based IDs for showcase items (instead of numbers)
    styledoc.states_modify_unique_attrs = true; // modify "id" and "for" attr values to preserve their uniqueness when generating states
    styledoc.states_html_glue = "\n"; // @todo showcaseFile option?

    if (styledoc.server_mode) {
        window = jsdom.jsdom().parentWindow;
        $ = $(window);
        styledoc.templates_dir = path.dirname(module.filename) + "/templates/";
    } else {
        styledoc.templates_dir = "js/styledoc/templates/";
    }

    // tag_name: is_multiline // @todo set is_complex here
    styledoc.known_tags = {
        "$title":       false,  // block title
        "$description": true,   // block description
        "section":      false,  // (legacy?)
        "base":         false,  // base selector (e.g. .my-element)
        "modifier":     false,  // CSS-selector based modifier for element (e.g .my-subclass)
        "state":        false,  // a special kind of modifier, also added to each presentation (e.g. :disabled or .active)
        "pseudo":       false,  // (legacy) in this version, just an alias of @state
        "example":      true,   // HTML to use in both code snippet and live presentation
        "presentation": true,   // overrides @example for HTML to use in live presentation
        "markup":       true,   // (legacy) alias of @example
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
     * @param {string} [options.page_title=""] Main title of document (in HTTP mode, defaults to document.title)
     * @param {string} [options.iframe_delay=2000] Delay (ms) before refreshing iframe height
     * @param {boolean} [options.use_phantomjs=false] Use PhantomJS to preset iframes height (FS mode only)
     * @param {object} [options.phantomjs_viewport={ width: 1280, height: 800 }] Viewport size for phantomjs instances (FS mode only)
     * @param {boolean} [options.silent_mode=false] No console messages (FS mode only)
     * @param {number|number[]} [options.presentation_padding] Padding value(s) for presentation container (4 or [4, 8], or [4, 0, 12, 8] etc.)
     */
    styledoc.showcaseFile = function (url, options) {
        options = options || {};
        options.template = options.template || DEFAULT_TEMPLATE;
        options.language = options.language || DEFAULT_LANGUAGE;
        options.doctype = options.doctype || DEFAULT_DOCTYPE;
        options.iframe_delay = options.iframe_delay || DEFAULT_IFRAME_DELAY;

        styledoc.loadFileRecursive(url).done(function (files_data) {
            var showcase_data = styledoc.prepareShowcaseData(styledoc.extractDocsData(files_data));
            var output = styledoc.getOutput();
            output(showcase_data, url, options);
        });
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
        var result = [];

        var i,
            j,
            parts,
            modifier,
            doc,
            item_data,
            tag_data,
            tag_name,
            tag_content;
        for (i = 0; i < docs_data.length; i++) {

            doc = docs_data[i];
            item_data = {
                id: i + 1,
                section: null,
                title: null,
                description: null,
                base: null,
                base_description: null,
                example: null,
                presentation: null,
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
                        break;
                    case "base":
                        parts = parseComplexContent(tag_content);
                        item_data.base = parts[0];
                        item_data.base_description = parts[1];
                        item_data.title = item_data.title || parts[1];
                        break;
                    case "example":
                    case "markup":
                        item_data.example = item_data.example || tag_content;
                        item_data.presentation = item_data.presentation || tag_content;
                        break;
                    case "presentation":
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
                item_data.subitems.push({
                    id: styledoc.use_selector_based_ids ? selectorToId(item_data.base) : item_data.id + "_0",
                    base: item_data.base,
                    modifier: null,
                    description: item_data.base_description || "",
                    //example: styledoc.htmlApplyStates(item_data.example, item_data.base, item_data.states, false),
                    example: styledoc.htmlApplyModifier(item_data.example, item_data.base, "", item_data.states, false),
                    //presentation: styledoc.htmlApplyStates(item_data.presentation, item_data.base, item_data.states, true)
                    presentation: styledoc.htmlApplyModifier(item_data.presentation, item_data.base, "", item_data.states, true)
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
                            item_data.subitems.push({
                                id: styledoc.use_selector_based_ids ? selectorToId(item_data.base + modifier) : (item_data.id + "_" + (j + 1)),
                                base: item_data.base,
                                modifier: modifier,
                                description: parts[1],
                                example: styledoc.htmlApplyModifier(item_data.example, item_data.base, modifier, item_data.states, false),
                                presentation: styledoc.htmlApplyModifier(item_data.presentation, item_data.base, modifier, item_data.states, true)
                            });
                            break;
                    }
                }
            }

            result.push(item_data);
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
     * @param {boolean} is_presentation Use presentation mode instead of HTML markup example mode
     * @returns {string}
     */
    styledoc.htmlApplyStates = function (html, base, states, is_presentation) {
        if (isArray(states) && states.length) {
            var html_base = html,
                result;
            for (var i = 0; i < states.length; i++) {
                result = styledoc.htmlApplyModifier(html_base, base, states[i].state, undefined, is_presentation, styledoc.states_modify_unique_attrs);
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
     * @param {boolean} is_presentation Use presentation mode instead of HTML markup example mode
     * @param {boolean} modify_unique_attrs Add suffix to any "id" or "for" attr value found within the code
     * @returns {string}
     */
    styledoc.htmlApplyModifier = function (html, base, modifier, states, is_presentation, modify_unique_attrs) {
        var $wrapper = $("<styledoc-wrapper>").append(html); // @todo hardcode tag name
        var $elem = $(base, $wrapper);

        // Basic modify
        var modify_by_selector = modifier && $elem.length;
        if (modify_by_selector) {
            var parsed = $.find.tokenize(modifier).pop();
            var item,
                attr_name,
                attr_value;
            for (var i = 0; i < parsed.length; i++) {
                item = parsed[i];
                attr_name = null;
                attr_value = "";
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
                }
                if (attr_name === "class") {
                    $elem.addClass(attr_value);
                } else if (attr_name) {
                    $elem.attr(attr_name, attr_value);
                }
            }
        }

        // Modify "id" and "for" attribute values for any child elements (if enabled)
        if (modify_unique_attrs) {
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
            var result = styledoc.htmlApplyModifierCustom(html, base, modifier, is_presentation, $wrapper, $elem);
            if (typeof result === "string") {
                html = result;
            }
        }

        // Apply states
        html = styledoc.htmlApplyStates(html, base, states, is_presentation);


        return html;
    };

    styledoc.htmlApplyModifierCustom = null; // @todo find a better way to modify example content?


    /**
     * Create showcase page from data provided (HTTP/browser mode)
     * @param {object} showcase_data Showcase data to be output
     * @param {string} css_url URL to CSS file (relative to showcase page or absolute)
     * @param {object|string} [options]
     * @param {string} [options.template="default"] Name of showcase page template
     * @param {string} [options.language="en"] Language to apply when creating page
     * @param {string} [options.doctype="html5"] Target doctype
     * @param {string} [options.$container=$("body")] Root container for showcase in parent document
     * @param {string} [options.page_title=document.title] Main title of document
     * @param {string} [options.iframe_delay=2000] Delay (ms) before refreshing iframe height
     * @param {number|number[]} [options.presentation_padding] Padding value(s) for presentation container (4 or [4, 8], or [4, 0, 12, 8] etc.)
     */
    styledoc.outputHttp = function (showcase_data, css_url, options) {

        var dfd = $.Deferred();

        var $container = options.$container || $("body");
        var page_title = options.page_title || document.title;
        var language = options.language;
        var doctype = options.doctype;
        var iframe_delay = options.iframe_delay;

        var template_name = options.template;
        var template_dir = styledoc.templates_dir + template_name + "/";

        var css_url_presentation;
        if (isAbsolutePath(css_url)) {
            css_url_presentation = css_url;
        } else {
            css_url_presentation = "//" + document.location.host + dirPath(document.location.pathname) + css_url;
        }

        var presentation_container_style = getPresentationContainerStyle(options);

        $("head").append('<link rel="stylesheet" href="' + template_dir + 'main.css">');

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
                    css_url: css_url_presentation,
                    iframe_url: template_dir + PRESENTATION_SUBDIR + doctype + ".html",
                    items: showcase_data,
                    presenter: displayPresentation
                });
                $container.append(main_content).trigger("complete");
                dfd.resolve();
            }
        );

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
        function displayPresentation() {
            var data = this;
            $container.on("complete", function () {
                var $iframe = $("iframe#presentation_" + data.id);
                if ($iframe.length) {
                    $iframe.load(function () {
                        var $contents = $iframe.contents();
                        $contents.find("head").append('<link rel="stylesheet" href="' + css_url_presentation + '">');
                        $contents.find("#styledoc-container") // @todo hardcode id
                            .append(data.presentation)
                            .attr("style", presentation_container_style);
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
     * @param {object} options
     * @param {string} [options.template="default"] Name of showcase page template
     * @param {string} [options.language="en"] Language to apply when creating page
     * @param {string} [options.doctype="html5"] Target doctype
     * @param {string} [options.page_title=""] Main title of document
     * @param {string} [options.output_dir="showcase/"] Path to showcase page directory (relative to current location)
     * @param {string} [options.iframe_delay=2000] Delay (ms) before refreshing iframe height
     * @param {boolean} [options.use_phantomjs=false] Use PhantomJS to preset iframes height
     * @param {boolean} [options.silent_mode=false] No console messages
     * @param {object} [options.phantomjs_viewport={ width: 1280, height: 800 }] Viewport size for phantomjs instances
     * @param {number|number[]} [options.presentation_padding] Padding value(s) for presentation container (4 or [4, 8], or [4, 0, 12, 8] etc.)
     */
    styledoc.outputFs = function (showcase_data, css_url, options) {

        var dfd = $.Deferred();

        var page_title = options.page_title || "";
        var language = options.language;
        var doctype = options.doctype;

        var iframe_delay = options.iframe_delay;
        var use_phantomjs = !!options.use_phantomjs;
        var phantomjs_viewport = options.phantomjs_viewport || { width: 1280, height: 800 }; // @todo more convinient way? (e.g. "1280x800")

        var silent_mode = !!options.silent_mode;

        var output_dir = options.output_dir || DEFAULT_OUTPUT_DIR;
        output_dir = ensureTrailingSlash(output_dir);

        var presentation_dir = output_dir + PRESENTATION_SUBDIR;
        var template_name = options.template;
        var template_dir = styledoc.templates_dir + template_name + "/";

        var realpath = ensureTrailingSlash(fs.realpathSync("./"));
        var css_url_presentation;
        if (isAbsolutePath(css_url)) {
            css_url_presentation = css_url;
        } else {
            css_url_presentation = path.relative(realpath + presentation_dir, realpath + css_url);
        }

        var presentation_container_style = getPresentationContainerStyle(options);

        var loadFile = styledoc.getLoader().loadFile;
        // @todo optimize (something better than: force_fs = true)
        var load_index_template = loadFile(template_dir + "index.mustache", false, true);
        var load_main_template = loadFile(template_dir + "main.mustache", false, true); // @todo doctype?
        var load_presentation_template = loadFile(template_dir + PRESENTATION_SUBDIR + doctype + ".mustache", false, true);
        var load_lang = loadFile(template_dir + LANGUAGE_SUBDIR + language + ".json", true, true);

        var mkdirs = mkdirp(presentation_dir);
        var copy_main_css = copy(template_dir + "main.css", output_dir + "main.css");
        var copy_presentation_css = copy(template_dir + "presentation.css", output_dir + "presentation.css");


        if (!silent_mode) {
            console.log(chalk.yellow("\nStyleDoc v" + MODULE_VERSION));
            console.log("Creating showcase in directory: " + output_dir);
            console.log("\nLoading resources...");
        }

        // @todo fail?
        $.when(load_index_template, load_main_template, load_presentation_template, load_lang, mkdirs, copy_main_css, copy_presentation_css).done(
            function (index_template, main_template, presentation_template, lang_data) {

                if (!silent_mode) {
                    console.log("All resources loaded");
                }

                var items_count = showcase_data.length,
                    subitems_count = 0,
                    presentations_count = 0,
                    presentations_dfd = $.Deferred(),
                    i,
                    j,
                    subitem_data,
                    file_name,
                    file_path,
                    file_path_relative,
                    presentation_content;
                for (i = 0; i < items_count; i++) {
                    subitems_count += showcase_data[i].subitems.length;
                }

                if (!silent_mode) {
                    console.log("\nCreating presentation files (" + subitems_count + " total)");
                }

                for (i = 0; i < items_count; i++) {
                    for (j = 0; j < showcase_data[i].subitems.length; j++) {
                        subitem_data = showcase_data[i].subitems[j];
                        file_name = subitem_data.id + ".html";
                        file_path = presentation_dir + file_name;
                        file_path_relative = PRESENTATION_SUBDIR + file_name;
                        presentation_content = Mustache.render(presentation_template, {
                            css_url: css_url_presentation,
                            container_style: presentation_container_style,
                            content: subitem_data.presentation
                        });
                        subitem_data.iframe_url = file_path_relative; // @todo use separate var without changing showcase_data?
                        (function (file_path, presentation_content, subitem_data) {
                            fs.writeFile(
                                file_path,
                                presentation_content,
                                function () {

                                    if (!silent_mode) {
                                        console.log(chalk.cyan("[CREATE] " + file_path));
                                    }

                                    // iframe delay mode
                                    if (!use_phantomjs) {
                                        countPresentationItem();
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

                                                        countPresentationItem();
                                                        ph.exit();
                                                    }
                                                );
                                            });

                                        });
                                    });
                                }
                            );
                        })(file_path, presentation_content, subitem_data);
                    }
                }

                function countPresentationItem() {
                    if (++presentations_count === subitems_count) {
                        presentations_dfd.resolve();
                    }
                }

                presentations_dfd.done(function () {

                    if (!silent_mode) {
                        console.log("All presentation files created");
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
                            content: main_content,
                            use_phantomjs: use_phantomjs,
                            iframe_delay: iframe_delay // @todo unify with http mode
                        }),
                        function () {
                            if (!silent_mode) {
                                console.log(chalk.cyan("[CREATE] " + output_dir + "index.html"));
                                console.log("Index file created");
                                console.log(chalk.green("\nAll done!\n"));
                            }
                            dfd.resolve(); // @todo is it really needed?
                        }
                    );
                });

            }
        );

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

        var doc_mask = /\/\*\*\s+[\S\s]+?\s+\*\//g;
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
        var doc_begin_mask = /^\/\*\*\s?/;
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
     * @returns {boolean}
     */
    function isArray(value) {
        return value && (value instanceof Array);
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
     * Generate value for the presentation container "style" attribute
     * @param {object} options
     * @param {number|number[]} [options.presentation_padding] Padding value(s) for presentation container (4 or [4, 8], or [4, 0, 12, 8] etc.)
     * @returns {string|undefined} Undefined value denies redundant attribute creating: $elem.attr("style", undefined)
     * @todo enable string value for presentation_padding (like "4px 8px")?
     */
    function getPresentationContainerStyle(options) {
        var presentation_container_style = "";

        var padding_value = options.presentation_padding;
        if (typeof padding_value === "number") {
            padding_value = [ padding_value ];
        }
        if (isArray(padding_value)) {
            presentation_container_style += "padding: " + padding_value.join("px ") + "px !important; ";
        }

        return presentation_container_style.replace(/\s$/, "") || undefined;
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
        var mask = /[^a-z0-9_-]/ig;
        return selector.replace(mask, "_");
    }

    // @todo improve naming and structure
    styledoc.getLoader = function () {
        return styledoc.server_mode ? styledoc.loaderFs : styledoc.loaderHttp;
    };

    styledoc.getOutput = function () {
        return styledoc.server_mode ? styledoc.outputFs : styledoc.outputHttp;
    };



    return styledoc;
}));
