// ==UserScript==
// @name         YTScript_test
// @description  YouTube player enhancement
// @author       michi-at
// @version      0.1.915
// @updateURL    https://raw.githubusercontent.com/michi-at/YTScript/test/YTScript_test.meta.js
// @downloadURL  https://raw.githubusercontent.com/michi-at/YTScript/test/YTScript_test.user.js
// @match        *://www.youtube.com/*
// @exclude      *://www.youtube.com/embed/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-start
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// ==/UserScript==

(function () {
    "use strict";

    const DEBUG = true;



    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css";
    document.head.appendChild(link);
    link.href = "https://michi-at.github.io/css/YTStyles.min.css";
    document.head.appendChild(link);



    function Log(text) {
        console.info(`${GM_info.script.name}: ${text}`);
    }

    class ComponentManager {
        constructor() {
            this.components = {};
            this.info = GM_info;
            this.config = this.LoadConfig();
            this.events = {};

            if (DEBUG) {
                console.log("ComponentManager config:", this.config);
            }
        }

        LoadConfig() {
            let config = JSON.parse(GM_getValue(this.info.script.name) || "null") || {};
            return config;
        }

        Initialize() {
            for (const [, value] of Object.entries(this.events)) {
                if (value.eventListener) {
                    value.eventTarget.addEventListener(value.eventName, value.eventListener, value.useCapture);
                }
            }

            for (const [, value] of Object.entries(this.components)) {
                value.Initialize();
            }

            return this;
        }

        AddComponent(component) {
            this.components[component.name] = component;
            this.config[component.name] = this.config[component.name] || {};
            component.LoadConfig(this.config[component.name]);
            this.WatchComponentConfig(component);

            return this;
        }

        WatchComponentConfig(component) {
            this.events[component.name] = {
                eventTarget: component,
                eventName: component.events.onConfigSave.eventName,
                eventListener: this.ComponentConfigSave.bind(this),
                useCapture: false
            }
        }

        ComponentConfigSave(event) {
            this.config[event.target.name] = event.detail;
            this.SaveConfig();
        }

        EditConfig(componentName, value) {
            this.config[componentName] = value;
            this.SaveConfig();
        }

        SaveConfig() {
            let configString = JSON.stringify(this.config);
            GM_setValue(this.info.script.name, configString);
        }
    }
    const manager = new ComponentManager();



    /* Utils */
    class Slider {
        constructor(target, options) {
            this.sliderClassName = options.className;
            target.className = `${this.sliderClassName}-container`;
            this.api = document.createElement("div");
            this.api.className = this.sliderClassName;
            target.appendChild(this.api);
            $(this.api).slider(options.widjetOptions);

            this.api.children[1].setAttribute("tooltip", options.widjetOptions.value.toString());
            $(this.api).on("slide slidechange", function (event, ui) {
                this.children[1].setAttribute("tooltip", ui.value);
            });

            this.events = {
                onFullscreenChange: {
                    eventTarget: document,
                    eventName: "fullscreenchange",
                    eventListener: this.FullscreenChange.bind(this),
                    useCapture: false
                }
            }
        }

        FullscreenChange() {
            this.api.classList.toggle(`${this.sliderClassName}-fullscreen`);
        }

        Initialize() {
            for (const [, value] of Object.entries(this.events)) {
                if (value.eventListener) {
                    value.eventTarget.addEventListener(value.eventName, value.eventListener, value.useCapture);
                }
            }

            return this;
        }
    }

    const Utils = {
        Animate: function ({ duration, timing, draw, complete }) {

            let start = performance.now();

            requestAnimationFrame(function animate(time) {
                let timeFraction = (time - start) / duration;
                if (timeFraction > 1) timeFraction = 1;
                if (timeFraction < 0) timeFraction = 0;

                let progress = timing(timeFraction);
                console.log(timeFraction, progress);
                draw(progress, complete);

                if (timeFraction < 1) {
                    requestAnimationFrame(animate);
                }
            });
        }
    }
    /* End of Utils */



    /* Components */
    class Component extends EventTarget {
        constructor() {
            super();

            this.name = this.constructor.name;

            this.events = {
                onConfigSave: {
                    eventTarget: this,
                    eventName: "ConfigSaved",
                    eventListener: null,
                    useCapture: false
                },
                onLoad: {
                    eventTarget: document.documentElement,
                    eventName: "load",
                    eventListener: this.Load.bind(this),
                    useCapture: true
                },
                onListenerRemove: {
                    eventTarget: this,
                    eventName: "ListenerRemove",
                    eventListener: this.StopListening.bind(this),
                    useCapture: false
                },
                onYtNavigateStart: {
                    eventTarget: window,
                    eventName: "yt-navigate-start",
                    eventListener: this.YtNavigateStarted.bind(this),
                    useCapture: false
                },
                onYtNavigateFinish: {
                    eventTarget: window,
                    eventName: "yt-navigate-finish",
                    eventListener: this.YtNavigateFinished.bind(this),
                    useCapture: false
                }
            };
            this.status = {
                parent: this,
                _isLoaded: false
            };
            Object.defineProperty(this.status, "isLoaded", {
                get: function () {
                    return this._isLoaded;
                },
                set: function (value) {
                    if (typeof value === "boolean") {
                        this._isLoaded = value;
                        if (value) {
                            this.parent.dispatchEvent(
                                new CustomEvent(
                                    this.parent.events.onListenerRemove.eventName, {
                                        detail: this.parent.events.onLoad
                                    }
                                )
                            );
                        }
                    }
                }
            });

            this.UpdateLocation();
        }

        Load() {
            this.status.isLoaded = true;
        }

        StopListening(event) {
            let info = event.detail;
            info.eventTarget.removeEventListener(info.eventName, info.eventListener, info.useCapture);
        }

        YtNavigateStarted(event) {

        }

        YtNavigateFinished(event) {
            this.UpdateLocation();
        }

        Initialize() {
            for (const [, value] of Object.entries(this.events)) {
                if (value.eventListener) {
                    value.eventTarget.addEventListener(value.eventName, value.eventListener, value.useCapture);
                }
            }

            return this;
        }

        UpdateLocation() {
            let videoId, playlistId, location = window.location;

            [, videoId] = /(?:\?|&)v=([a-zA-Z0-9\-\_]+)/g.exec(location.search) || [, ""];
            [, playlistId] = /(?:\?|&)list=([a-zA-Z0-9\-\_]+)/g.exec(location.search) || [, ""];

            this.location = {
                pageType: location.pathname.length === 1 ? "browse" : location.pathname.substring(1),
                url: location.pathname + location.search,
                videoId: videoId,
                playlistId: playlistId
            };
        }

        LoadConfig(data) {
            this.config = data;
        }

        SaveConfig(newConfig) {
            let event = new CustomEvent(this.events.onConfigSave.eventName, {
                detail: newConfig
            });
            this.dispatchEvent(event);
        }

        ClearConfig() {
            this.SaveConfig({});
        }
    }

    class UIComponent extends Component {
        constructor() {
            super();

            this.events.onUILoad = {
                eventTarget: document.documentElement,
                eventName: "load",
                eventListener: this.LoadUI.bind(this),
                useCapture: true
            };
            this.status._isUILoaded = false;
            Object.defineProperty(this.status, "isUILoaded", {
                get: function () {
                    return this._isUILoaded;
                },
                set: function (value) {
                    if (typeof value === "boolean") {
                        this._isUILoaded = value;
                        if (value) {
                            this.parent.dispatchEvent(
                                new CustomEvent(
                                    this.parent.events.onListenerRemove.eventName, {
                                        detail: this.parent.events.onUILoad
                                    }
                                )
                            );
                        }
                    }
                }
            });
        }

        LoadUI() {
            this.status.isUILoaded = true;
        }
    }

    class ComponentPanel extends UIComponent {
        constructor() {
            super();
            this.slideDuration = 500;

            this.root = document.createElement("div");
            this.root.className = "ytscript-panel-main";

            this.openMenuButton = document.createElement("button");
            this.openMenuButton.className = "show-content";
            this.openMenuButton.innerHTML = '<i class="fa fa-angle-double-down"></i>';
            this.events.onMenuButtonClick = {
                eventTarget: this.openMenuButton,
                eventName: "click",
                eventListener: this.MenuButtonClicked.bind(this),
                useCapture: false
            }

            this.container = document.createElement("div");
            this.container.className = "ytscript-container";

            this.root.appendChild(this.container);
            this.root.appendChild(this.openMenuButton);
        }

        MenuButtonClicked(e) {
            e.preventDefault();
            this.CalculateContainerHeight();
            if (this.container.classList.contains("open")) {
                Utils.Animate({
                    duration: this.slideDuration,
                    timing: this.EaseUp,
                    draw: this.SlideUp.bind(this),
                    complete: this.TestComplete.bind(this)
                });
            }
            else {
                Utils.Animate({
                    duration: this.slideDuration,
                    timing: this.EaseDown,
                    draw: this.SlideDown.bind(this),
                    complete: this.TestComplete.bind(this)
                });
            }
            this.container.classList.toggle("open");
            e.stopPropagation();
        }

        TestComplete() {
            
        }

        SlideDown(progress, complete) {
            this.container.style.height = this.containerHeight * progress + "px";
            if (progress === 1) {
                complete();
            }
        }

        SlideUp(progress, complete) {
            this.container.style.height = this.containerHeight * (1 - progress) + "px";
            if (progress === 1) {
                complete();
            }
        }

        Ease(t) {
            let square = t * t;
            return square / (2.0 * (square - t) + 1.0);
        }

        EaseDown(t) {
            let square = t * t;
            return 3.54 * t - 3.42 * square + 0.88 * t * square;
        }

        EaseUp(t) {
            return t * t * (3 * t - 2);
        }

        CreatePanelItem({ componentName, titleIconHtml, contentNode }) {
            componentName = componentName.replace(/(\B[A-Z]+?(?=[A-Z][^A-Z])|\B[A-Z]+?(?=[^A-Z]))/, " $1")
                .replace(/(\S*)(.*\S*.*)/, '<span class="first">$1</span>$2');

            let componentMenu = document.createElement("div");
            componentMenu.className = "component-menu";
            componentMenu.GetRenderedHeight = this.GetRenderedHeight(componentMenu);

            let componentTitle = document.createElement("div");
            componentTitle.className = "component-title";
            componentTitle.insertAdjacentHTML("afterbegin", titleIconHtml);
            componentTitle.insertAdjacentHTML("beforeend", `<span>${componentName}</span>`);

            let hideContentButton = document.createElement("button");
            hideContentButton.className = "hide";
            hideContentButton.insertAdjacentHTML("afterbegin", '<i class="fa fa-minus"></i>');
            componentTitle.appendChild(hideContentButton);

            let componentContent = document.createElement("div");
            componentContent.className = "component-content";
            componentContent.appendChild(contentNode);

            const HideContent = (e) => {
                e.preventDefault();

                $(componentContent).slideToggle(400, function () {
                    $(hideContentButton).toggleClass("open");
                    this.CalculateContainerHeight();
                    console.log(this.containerHeight);
                }.bind(this));

                e.stopPropagation();
            }

            componentTitle.addEventListener("click", HideContent.bind(this));
            hideContentButton.addEventListener("click", HideContent.bind(this));

            componentMenu.appendChild(componentTitle);
            componentMenu.appendChild(componentContent);

            this.container.appendChild(componentMenu);
        }

        CalculateContainerHeight() {
            this.containerHeight = 0;
            for (let elem of this.container.children) {
                this.containerHeight += elem.GetRenderedHeight();
            }
        }

        GetRenderedHeight(elem) {
            let computedStyle = window.getComputedStyle(elem);
            let marginTop = parseInt(computedStyle.getPropertyValue("margin-top"));
            let marginBottom = parseInt(computedStyle.getPropertyValue("margin-bottom"));
            return function () {
                if (computedStyle.length === 0) {
                    computedStyle = window.getComputedStyle(elem);
                    marginTop = parseInt(computedStyle.getPropertyValue("margin-top"));
                    marginBottom = parseInt(computedStyle.getPropertyValue("margin-bottom"));
                }
                if (isNaN(marginTop)) marginTop = parseInt(computedStyle.getPropertyValue("margin-top"));
                if (isNaN(marginBottom)) marginBottom = parseInt(computedStyle.getPropertyValue("margin-bottom"));
                return elem.offsetHeight + marginTop + marginBottom;
            }
        }

        LoadUI() {
            let injectionTarget;
            if ((injectionTarget = document.querySelector("ytd-watch-flexy #player")) && !this.root.api) {
                injectionTarget.appendChild(this.root);
                this.root.api = this;
            }

            if (this.root.api) {
                this.status.isUILoaded = true;
                if (DEBUG) {
                    Log(`${this.name}'s UI has been loaded.`);
                }
            }
        }

        YtNavigateStarted(event) {}
        YtNavigateFinished(event) {}
    }

    class VolumeControl extends UIComponent {
        constructor() {
            super();
        }

        Load() {
            let videoElement;
            if ((videoElement = document.getElementsByClassName("html5-main-video")[0]) && !this.gain) {
                let audioContext = new AudioContext();
                let source = audioContext.createMediaElementSource(videoElement);
                let gainNode = audioContext.createGain();
                this.gain = gainNode.gain;

                this.UpdateLocation();

                let videoSettings = this.config.list[this.location.videoId] || {
                    volume: 1
                };
                this.gain.value = videoSettings.volume;
                gainNode.connect(audioContext.destination);
                source.connect(gainNode);
            }

            if (this.gain) {
                this.status.isLoaded = true;
                if (DEBUG) {
                    Log(`${this.name} has been loaded.`);
                }
            }
        }

        LoadUI() {
            let injectionTarget;
            if ((injectionTarget = document.querySelector("ytd-player .ytp-chrome-bottom " +
                ".ytp-chrome-controls .ytp-left-controls")) && !this.slider)
            {
                let sliderContainer = document.createElement("div");

                let videoSettings = this.config.list[this.location.videoId] || {
                    volume: 1
                };

                this.slider = new Slider(sliderContainer, {
                    className: "ytscript-slider-volume",
                    widjetOptions: {
                        min: 0,
                        max: 5,
                        value: videoSettings.volume,
                        range: "min",
                        step: 0.05,
                        slide: this.ChangeVolume.bind(this),
                        stop: this.VolumeConfirmed.bind(this)
                    }
                }).Initialize();
                injectionTarget.appendChild(sliderContainer);
            }

            if ((injectionTarget = document.getElementsByClassName("ytscript-panel-main")[0]) &&
                !this.controls)
            {
                this.controls = document.createElement("div");
                this.controls.className = "ytscript-controls-volume";

                let clearConfigButton = document.createElement("button");
                clearConfigButton.className = "ytscript-button";
                clearConfigButton.insertAdjacentHTML("beforeend", '<i class="fa fa-eraser"></i>');
                clearConfigButton.insertAdjacentText("beforeend", "Clear config");
                clearConfigButton.addEventListener("click", this.ClearConfig.bind(this));

                this.controls.appendChild(clearConfigButton);

                injectionTarget.api.CreatePanelItem({
                    componentName: this.name,
                    titleIconHtml: '<i class="fa fa-volume-up"></i>',
                    contentNode: this.controls
                });
            }

            if (this.slider && this.controls) {
                this.status.isUILoaded = true;
                if (DEBUG) {
                    Log(`${this.name}'s UI has been loaded.`);
                }
            }
        }

        VolumeConfirmed(event, ui) {
            this.config.list[this.location.videoId] = { volume: ui.value };
            this.SaveConfig(this.config);
        }

        ChangeVolume(event, ui) {
            this.gain.value = ui.value;
        }

        YtNavigateStarted(event) {
            if (event.detail.pageType === "watch") {
                let videoSettings = this.config.list[event.detail.endpoint.watchEndpoint.videoId] || {
                    volume: 1
                };
                this.gain.value = videoSettings.volume;
                $(this.slider.api).slider("value", this.gain.value);
            }
        }

        LoadConfig(data) {
            super.LoadConfig(data);
            this.config.list = this.config.list || {};

            if (DEBUG) {
                console.log(`${this.name}'s config:`, this.config);
            }
        }

        ClearConfig() {
            this.SaveConfig({ list: {} });
        }
    }

    class PlaybackControl extends UIComponent {
        constructor() {
            super();
        }

        Load() {

        }

        LoadUI() {

        }

        LoadConfig(data) {
            super.LoadConfig(data);
            this.config.list = this.config.list || {};
        }

        ClearConfig() {
            this.SaveConfig({ list: {} });
        }
    }
    /* End of Components */



    manager.AddComponent(new ComponentPanel())
           .AddComponent(new VolumeControl())
           .Initialize();
})();