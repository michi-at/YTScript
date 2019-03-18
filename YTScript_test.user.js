// ==UserScript==
// @name         YTScript_test
// @description  YouTube player enhancement
// @author       michi-at
// @version      0.3.102
// @updateURL    https://raw.githubusercontent.com/michi-at/YTScript/test/YTScript_test.meta.js
// @downloadURL  https://raw.githubusercontent.com/michi-at/YTScript/test/YTScript_test.user.js
// @match        *://www.youtube.com/*
// @exclude      *://www.youtube.com/embed/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @run-at       document-start
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @require      https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// ==/UserScript==

(function () {
    "use strict";

    let link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css";
    document.head.appendChild(link);
    link.href = "https://michi-at.github.io/css/YTStyles_test.min.css";
    document.head.appendChild(link);


    const GLOBAL_EVENTS = {
        componentMessageSent: "ComponentMessageSent",
        configSaved: "ConfigSaved",
        navigationManagerLoaded: "NavigationManagerLoaded"
    }

    class ComponentManager {
        constructor() {
            this.components = {};
            this.info = GM_info;
            this.config = this.LoadConfig();
            this.events = { };
        }

        LoadConfig() {
            let config = JSON.parse(GM_getValue(this.info.script.name) || "null") || {};
            return config;
        }

        Initialize() {
            for (const [, e] of Object.entries(this.events)) {
                if (e.eventListener) {
                    e.eventTarget.addEventListener(e.eventName, e.eventListener, e.useCapture);
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
            component.index = Object.keys(this.components).length;
            this.RegisterComponentEvents(component);

            return this;
        }

        RegisterComponentEvents(component) {
            this.events[component.name] = {
                eventTarget: component,
                eventName: GLOBAL_EVENTS.componentMessageSent,
                eventListener: this.ComponentMessageSent.bind(this),
                useCapture: false
            }
        }

        ComponentMessageSent(event) {
            switch (event.detail.type) {
                case GLOBAL_EVENTS.configSaved: {
                    this.config[event.target.name] = event.detail.config;
                    this.components[event.target.name].LoadConfig(this.config[event.target.name]);
                    this.SaveConfig();

                    break;
                }
            }
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



    class Slider {
        constructor(target, options) {
            this.sliderClassName = options.className;
            target.className = `${this.sliderClassName}-container`;
            this.api = document.createElement("div");
            this.api.className = this.sliderClassName;
            target.appendChild(this.api);
            $(this.api).slider(options.widjetOptions);

            this.SetTooltip(options.widjetOptions);

            this.events = {
                onFullscreenChange: {
                    eventTarget: document,
                    eventName: "fullscreenchange",
                    eventListener: this.FullscreenChange.bind(this),
                    useCapture: false
                }
            }
        }

        SetTooltip({ value, values, range } = options) {
            if (range === "min") {
                this.api.children[1].setAttribute("tooltip", value || "");
                $(this.api).on("slide slidechange", function (event, ui) {
                    this.children[1].setAttribute("tooltip", ui.value);
                });
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

                ((progress, complete) => {
                    draw(progress);
                    
                    if (progress === 1) {
                        complete();
                    }
                })(progress, complete);

                if (timeFraction < 1) {
                    requestAnimationFrame(animate);
                }
            });
        },
        LinearInterpolation: function (x1, y1, x2, y2) {
            let a = (y1 - y2) / (x1 - x2);
            let b = (x1 * y2 - x2 * y1) / (x1 - x2);
            return function (x) {
                return a * x + b;
            }
        },
        Ease: function (t) {
            return t * t / (2.0 * (t * t - t) + 1.0);
        },
        EaseDown: function (t) {
            return t * (3.54 - 3.42 * t + 0.88 * t * t);
        },
        EaseUp: function (t) {
            return t * t * (3 * t - 2);
        },
        SecondsToTimeString: function (seconds) {
            let hours = Math.floor(seconds / 3600);
            seconds -= hours * 3600;
            let minutes = Math.floor(seconds / 60);
            seconds -= minutes * 60;
            let milliseconds = Math.round((seconds % 1) * 1000);
            if (milliseconds === 1000) {
                milliseconds = 0;
                seconds = Math.round(seconds);
            }
            else {
                seconds = Math.floor(seconds);
            }	
    
            if (hours < 10) { hours = "0" + hours; }
            if (minutes < 10) { minutes = "0" + minutes; }
            if (seconds < 10) { seconds = "0" + seconds; }
            if (milliseconds < 100) { milliseconds = "0" + milliseconds; }
            if (milliseconds < 10) { milliseconds = "0" + milliseconds; }
            return hours > 0 ? hours + ":" + minutes + ":" + seconds + "." + milliseconds
                             : minutes + ":" + seconds + "." + milliseconds;
        }
    }



    class Component extends EventTarget {
        constructor() {
            super();

            this.name = this.constructor.name;

            this.events = {
                onLoad: {
                    eventTarget: document.documentElement,
                    eventName: "load",
                    eventListener: this.RunCallbackIfAllowed(this.Load, this.IsValidLocation).bind(this),
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
                    eventListener: this.RunCallbackIfAllowed(this.YtNavigateStarted, this.IsComponentReady).bind(this),
                    useCapture: false
                },
                onYtNavigateFinish: {
                    eventTarget: window,
                    eventName: "yt-navigate-finish",
                    eventListener: this.RunCallbackIfAllowed(this.YtNavigateFinished, this.IsComponentReady).bind(this),
                    useCapture: false
                },
                onNavigateStartToWatch: {
                    eventTarget: this,
                    eventName: "NavigateStartToWatch",
                    eventListener: this.NavigateStartedToWatch.bind(this),
                    useCapture: false
                },
                onNavigateStartToBrowse: {
                    eventTarget: this,
                    eventName: "NavigateStartToBrowse",
                    eventListener: this.NavigateStartedToBrowse.bind(this),
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
                            this.parent.dispatchEvent(new CustomEvent(
                                this.parent.events.onListenerRemove.eventName,
                                {
                                    detail: this.parent.events.onLoad
                                }
                            ));
                        }
                    }
                }
            });

            this.UpdateLocation();
        }

        NavigateStartedToWatch(event) { }

        NavigateStartedToBrowse(event) { }

        Load() {
            this.status.isLoaded = true;
        }

        StopListening(event) {
            let info = event.detail;
            info.eventTarget.removeEventListener(info.eventName, info.eventListener, info.useCapture);
        }

        IsComponentReady() {
            return this.status.isLoaded;
        }

        RunCallbackIfAllowed(callback, getPermission) {
            return function() {
                if (getPermission.call(this)) {
                    callback.apply(this, arguments);
                }
            }
        }

        YtNavigateStarted(event) {
            if (event.detail.pageType === "watch") {
                this.dispatchEvent(new CustomEvent(
                    this.events.onNavigateStartToWatch.eventName,
                    event
                ));
            }
            else if (event.detail.pageType === "browse") {
                this.dispatchEvent(new CustomEvent(
                    this.events.onNavigateStartToBrowse.eventName,
                    event
                ));
            }
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

            videoId = this.ParseValueFromUrl(location.search, "v");
            playlistId = this.ParseValueFromUrl(location.search, "list");

            this.location = {
                pageType: this.GetPageType(location),
                url: location.pathname + location.search,
                videoId: videoId,
                playlistId: playlistId
            };
        }

        ParseValueFromUrl(url, key) {
            let expression = `(?:\\?|&)${key}=([a-zA-Z0-9\\-\\_]+)`;
            let regExp = new RegExp(expression, "g");

            let value;
            [, value] = regExp.exec(url) || [, ""];
            return value;
        }
        
        GetPageType(location) {
            return location.pathname.indexOf("watch") !== -1 ? "watch" : "browse";
        }

        IsValidLocation() {
            this.UpdateLocation();
            if (this.location.pageType === "watch") {
                return true;
            }
            else {
                return false;
            }
        }
        
        LoadConfig(data) {
            this.config = data;
        }

        SaveConfig(newConfig) {
            let event = new CustomEvent(GLOBAL_EVENTS.componentMessageSent, {
                detail: {
                    type: GLOBAL_EVENTS.configSaved,
                    config: newConfig
                }
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
                eventListener: this.RunCallbackIfAllowed(this.LoadUI, this.IsValidLocation).bind(this),
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
                            this.parent.dispatchEvent(new CustomEvent(
                                this.parent.events.onListenerRemove.eventName,
                                {
                                    detail: this.parent.events.onUILoad
                                }
                            ));
                        }
                    }
                }
            });
        }

        LoadUI() {
            this.status.isUILoaded = true;
        }

        IsComponentReady() {
            return this.status.isLoaded && this.status.isUILoaded;
        }
    }

    class ComponentPanel extends UIComponent {
        constructor() {
            super();

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
            };

            this.container = document.createElement("div");
            this.container.className = "ytscript-container";
            this.container.slideDuration = 500;

            this.root.appendChild(this.container);
            this.root.appendChild(this.openMenuButton);
        }

        MenuButtonClicked(event) {
            event.preventDefault();
            this.CalculateContainerHeight();
            if (this.container.classList.contains("open")) {
                this.Slide({
                    element: this.container,
                    fromValue: this.container.renderedHeight,
                    toValue: 0,
                    easingFunction: Utils.EaseUp,
                    completeFunction: () => {
                        this.SlideComplete(this.openMenuButton);
                    }
                });
            }
            else {
                this.Slide({
                    element: this.container,
                    fromValue: 0,
                    toValue: this.container.renderedHeight,
                    easingFunction: Utils.EaseDown,
                    completeFunction: () => {
                        this.SlideComplete(this.openMenuButton);
                    }
                });
            }
            this.container.classList.toggle("open");
            event.stopPropagation();
        }
        
        Slide({ element, fromValue, toValue, easingFunction, completeFunction }) {
            const LinearFit = Utils.LinearInterpolation(0, fromValue, 1, toValue);
            Utils.Animate({
                duration: element.slideDuration,
                timing: easingFunction,
                draw: function (progress) {
                    element.style.height = LinearFit(progress) + "px";
                },
                complete: completeFunction
            });
        }
        
        SlideComplete(element) {
            element.classList.toggle("open");
        }

        CreatePanelItem({ componentName, componentIndex, titleIconHtml, contentNode }) {
            componentName = componentName.replace(/(\B[A-Z]+?(?=[A-Z][^A-Z])|\B[A-Z]+?(?=[^A-Z]))/, " $1")
                .replace(/(\S*)(.*\S*.*)/, '<span class="first">$1</span>$2');

            let componentMenu = document.createElement("div");
            componentMenu.className = "component-menu";
            componentMenu.index = componentIndex;
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
            componentContent.slideDuration = 300;

            contentNode.GetRenderedHeight = this.GetRenderedHeight(contentNode);

            componentContent.appendChild(contentNode);

            const HideContent = (event) => {
                event.preventDefault();
                
                if (componentContent.classList.contains("processing")) {
                    return;
                }

                const ToggleProcessing = () => {
                    componentContent.classList.toggle("processing");
                }

                ToggleProcessing();
                contentNode.renderedHeight = contentNode.renderedHeight || contentNode.GetRenderedHeight();
                if (componentContent.classList.contains("open")) {
                    this.container.renderedHeight -= contentNode.renderedHeight;
                    componentContent.style.overflow = "";
                    this.Slide({
                        element: componentContent,
                        fromValue: contentNode.renderedHeight,
                        toValue: 0,
                        easingFunction: Utils.Ease,
                        completeFunction: () => { 
                            this.SlideComplete(hideContentButton);
                        }
                    });
                    this.Slide({
                        element: this.container,
                        fromValue: this.container.renderedHeight + contentNode.renderedHeight,
                        toValue: this.container.renderedHeight,
                        easingFunction: Utils.Ease,
                        completeFunction: () => { 
                            ToggleProcessing();
                        }
                    });
                }
                else {
                    this.container.renderedHeight += contentNode.renderedHeight;
                    this.Slide({
                        element: componentContent,
                        fromValue: 0,
                        toValue: contentNode.renderedHeight,
                        easingFunction: Utils.Ease,
                        completeFunction: () => { 
                            this.SlideComplete(hideContentButton);
                            componentContent.style.overflow = "visible";
                        }
                    });
                    this.Slide({
                        element: this.container,
                        fromValue: this.container.renderedHeight - contentNode.renderedHeight,
                        toValue: this.container.renderedHeight,
                        easingFunction: Utils.EaseDown,
                        completeFunction: () => { 
                            ToggleProcessing();
                        }
                    });
                }
                componentContent.classList.toggle("open");

                event.stopPropagation();
            }

            componentTitle.addEventListener("click", HideContent);
            hideContentButton.addEventListener("click", HideContent);

            componentMenu.appendChild(componentTitle);
            componentMenu.appendChild(componentContent);

            let children = [...this.container.children];
            let point = children.find(e => {
               return e.index > componentMenu.index;
            });
            this.container.insertBefore(componentMenu, point);
        }

        CalculateContainerHeight() {
            this.container.renderedHeight = 0;
            for (const elem of this.container.children) {
                this.container.renderedHeight += elem.GetRenderedHeight();
            }
        }

        GetRenderedHeight(element) {
            let computedStyle = window.getComputedStyle(element);
            let marginTop = parseFloat(computedStyle.getPropertyValue("margin-top"));
            let marginBottom = parseFloat(computedStyle.getPropertyValue("margin-bottom"));
            return function () {
                if (computedStyle.length === 0) {
                    computedStyle = window.getComputedStyle(element);
                    marginTop = parseFloat(computedStyle.getPropertyValue("margin-top"));
                    marginBottom = parseFloat(computedStyle.getPropertyValue("margin-bottom"));
                }
                if (isNaN(marginTop)) marginTop = parseFloat(computedStyle.getPropertyValue("margin-top"));
                if (isNaN(marginBottom)) marginBottom = parseFloat(computedStyle.getPropertyValue("margin-bottom"));
                return element.offsetHeight + marginTop + marginBottom;
            }
        }

        LoadUI() {
            let injectionTarget;
            if (!this.root.api
                && (injectionTarget = document.querySelector("ytd-watch-flexy #player")))
            {
                injectionTarget.insertAdjacentElement("afterend", this.root);
                this.root.api = this;
            }

            if (this.root.api) {
                this.status.isUILoaded = true;
            }
        }
    }

    class NavigationManagerHack extends Component {
        constructor() {
            super();

            this.navigationHandlers = [];
        }

        Load() {
            if (!this.navigationManager
                && (this.navigationManager = document.querySelector("yt-navigation-manager")))
            {
                this.navigationManager.oldHandleNavigatePart = this.navigationManager.handleNavigatePart_;
            }

            if (this.navigationManager) {
                window.dispatchEvent(new CustomEvent(
                    GLOBAL_EVENTS.navigationManagerLoaded,
                    {
                        detail: {
                            RegisterHandler: this.RegisterNavigationHandler.bind(this),
                        }
                    }
                ));

                this.status.isLoaded = true;
            }
        }

        RegisterNavigationHandler(handler) {
            this.navigationHandlers.push(handler);
        }

        NavigateStartedToBrowse(event) {
            if (this.ParseValueFromUrl(event.detail.url, "list") !== ""
                && this.ParseValueFromUrl(event.detail.url, "playnext") !== "")
            {
                const MainHandler = function () {
                    for (let i = 0; i < arguments.length; ++i) {
                        if (arguments[i].hasOwnProperty("url")) {
                            let videoId = this.ParseValueFromUrl(arguments[i].url, "v");
                            if (videoId !== "") {
                                
                                for (let j = 0; j < this.navigationHandlers.length; ++j) {
                                    this.navigationHandlers[j](event, videoId);
                                }
        
                                this.SetHandleNavigatePart();
                                break;
                            }
                        }
                    }
                };
                if (this.navigationHandlers.length > 0) {
                    this.SetHandleNavigatePart(MainHandler);
                }
            }
        }

        SetHandleNavigatePart(callback) {
            let old = this.navigationManager.oldHandleNavigatePart;
            let control = this;
            this.navigationManager.handleNavigatePart_ = function () {
                old.apply(this, arguments);
                callback && callback.apply(control, arguments);
            }
        }
    }

    class PlayerComponent extends UIComponent {
        constructor() {
            super();

            this.events.onNavigationManagerLoaded = {
                eventTarget: window,
                eventName: GLOBAL_EVENTS.navigationManagerLoaded,
                eventListener: this.NavigationManagerLoaded.bind(this),
                useCapture: false
            }
        }

        NavigateStartedToBrowse(event) {
            if (this.ParseValueFromUrl(event.detail.url, "list") !== ""
                && this.ParseValueFromUrl(event.detail.url, "playnext") !== "")
            {
                this.ProcessNavStartToBrowseImmediately(event);
            }
        }

        NavigationManagerLoaded(event) {
            event.detail.RegisterHandler && event.detail.RegisterHandler(this.ProcessNavStartToBrowse.bind(this));
        }

        ProcessNavStartToBrowseImmediately(event) { }
        
        ProcessNavStartToBrowse(event, videoId) { }
    }

    class VolumeControl extends PlayerComponent {
        constructor() {
            super();

            this.DEFAULT_VALUE = 1;
            this.status.isProcessed = false;
            this.status.isVideoChanged = false;
        }

        Load() {
            if (!this.gain
                && (this.videoElement = document.getElementsByClassName("html5-main-video")[0]))
            {
                let audioContext = new AudioContext();
                let source = audioContext.createMediaElementSource(this.videoElement);
                let gainNode = audioContext.createGain();
                this.gain = gainNode.gain;

                this.UpdateVolume();

                gainNode.connect(audioContext.destination);
                source.connect(gainNode);

                this.status.isProcessed = true;
            }

            if (this.gain) {
                this.status.isLoaded = true;
            }
        }

        UpdateVolume() {
            this.UpdateLocation();
            this.UpdateVolumeByVideoId(this.location.videoId);
        }

        UpdateVolumeByVideoId(videoId) {
            this.gain.value =    this.config.list[videoId]
                              && this.config.list[videoId].volume
                              || this.DEFAULT_VALUE;
        }

        LoadUI() {
            let injectionTarget;
            if (this.gain
                && !this.slider
                && (injectionTarget = document.querySelector("ytd-player .ytp-chrome-bottom "
                                      + ".ytp-chrome-controls .ytp-left-controls")))
            {
                let sliderContainer = document.createElement("div");

                this.slider = new Slider(sliderContainer, {
                    className: "ytscript-slider-volume",
                    widjetOptions: {
                        min: 0,
                        max: 5,
                        value: this.gain.value,
                        range: "min",
                        step: 0.05,
                        slide: this.ChangeVolume.bind(this),
                        stop: this.VolumeConfirmed.bind(this)
                    }
                }).Initialize();
                injectionTarget.appendChild(sliderContainer);
            }

            if (!this.controls
                && (injectionTarget = document.getElementsByClassName("ytscript-panel-main")[0]))
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
                    componentIndex: this.index,
                    titleIconHtml: '<i class="fa fa-volume-up"></i>',
                    contentNode: this.controls
                });
            }

            if (this.slider && this.controls) {
                this.status.isUILoaded = true;
            }
        }

        VolumeConfirmed(event, ui) {
            if (ui.value === this.DEFAULT_VALUE) {
                delete this.config.list[this.location.videoId];
            }
            else {
                this.config.list[this.location.videoId] = { volume: ui.value };
            }
            
            this.SaveConfig(this.config);
        }

        ChangeVolume(event, ui) {
            this.gain.value = ui.value;
        }

        NavigateStartedToWatch(event) {
            this.location.videoId = this.ParseValueFromUrl(event.detail.url, "v");
            this.Update(this.location.videoId);
            this.status.isProcessed = true;
        }

        ProcessNavStartToBrowseImmediately(event) {
            const Callback = () => {
                this.status.isVideoChanged = true;
                
                this.dispatchEvent(new CustomEvent(
                    this.events.onListenerRemove.eventName,
                    {
                        detail: {
                            eventTarget: this.videoElement,
                            eventName: "durationchange",
                            eventListener: Callback,
                            useCapture: false
                        }
                    }
                ));
            };
            this.videoElement.addEventListener("durationchange", Callback);
        }

        ProcessNavStartToBrowse(event, videoId) {
            if (this.status.isVideoChanged) {
                this.Update(videoId, this.SetVolumeAndUpdateUI.bind(this));
            }
            else {
                this.Update(videoId);
            }

            this.status.isProcessed = true;
            this.status.isVideoChanged = false;
        }

        Update(videoId, callback) {
            this.UpdatePlayer(videoId, callback);
        }

        UpdatePlayer(videoId, cb) {
            if (cb) {
                cb(videoId);

                return;
            }

            const Callback = () => {
                this.SetVolumeAndUpdateUI(videoId);

                this.dispatchEvent(new CustomEvent(
                    this.events.onListenerRemove.eventName,
                    {
                        detail: {
                            eventTarget: this.videoElement,
                            eventName: "loadeddata",
                            eventListener: Callback,
                            useCapture: false
                        }
                    }
                ));
            };
            this.videoElement.addEventListener("loadeddata", Callback);
        }

        SetVolumeAndUpdateUI(videoId) {
            if (videoId) {
                this.UpdateVolumeByVideoId(videoId);
            }
            else {
                this.UpdateVolume();
            }
            this.UpdateUI();
        }

        UpdateUI() {
            $(this.slider.api).slider("value", this.gain.value);
        }

        YtNavigateFinished(event) {
            if (event.detail.pageType === "watch") {
                this.UpdateUI();
                if (!this.status.isProcessed) {
                    this.Update();
                }

                this.status.isProcessed = false;
            }
            else if (event.detail.pageType === "browse") {
                if (this.ParseValueFromUrl(event.detail.url, "list") !== ""
                && this.ParseValueFromUrl(event.detail.url, "playnext") !== "")
                {
                    this.Update();

                    this.status.isProcessed = false;
                }
            }
        }

        LoadConfig(data) {
            super.LoadConfig(data);
            this.config.list = this.config.list || {};
        }

        ClearConfig() {
            this.SaveConfig({ list: {} });
            this.UpdateVolume();
            this.UpdateUI();
        }
    }

    class TrimControl extends PlayerComponent {
        constructor() {
            super();

            this.DEFAULT_VALUE = [0, 100];
            this.status.isProcessed = false;
            this.status.isVideoChanged = false;
            this.epsilon = 0.0001;
        }

        Load() {
            if (!this.player
                && (this.player = document.getElementById("movie_player")))
            {
                this.UpdateTrimIntervalByVideoId(this.location.videoId);
                if (this.trimInterval) {
                    this.player.seekTo(this.trimInterval[0]);
                    this.status.isProcessed = true;
                }
            }

            !this.videoElement && (this.videoElement = document.getElementsByClassName("html5-main-video")[0]);

            if (this.player && this.videoElement) {
                this.videoElement.addEventListener("durationchange", () => {
                    this.InitLinearFit();
                    this.status.isUILoaded && this.UpdateUI();
                });
                this.InitLinearFit();
                
                this.WatchVideoProgress();

                this.status.isLoaded = true;
            }
        }

        InitLinearFit() {
            const duration = this.videoElement.getDuration();
            this.LinearFit = Utils.LinearInterpolation(this.DEFAULT_VALUE[0], 0,
                                                       this.DEFAULT_VALUE[1], duration);
            this.InverseLinearFit = Utils.LinearInterpolation(0, this.DEFAULT_VALUE[0],
                                                       duration, this.DEFAULT_VALUE[1]);
        }

        WatchVideoProgress() {
            requestIdleCallback(this.OnVideoProgress.bind(this), { timeOut: 100 });
        }

        OnVideoProgress() {
            if (this.trimInterval
                && this.InverseLinearFit
                && this.EuclidianDistance(this.InverseLinearFit(this.trimInterval[1]), this.DEFAULT_VALUE[1])
                   >= this.epsilon)
            {
                if (this.videoElement.getCurrentTime() >= this.trimInterval[1]) {
                    this.videoElement.loop ? this.player.seekTo(this.trimInterval[0])
                                        : this.player.nextVideo();
                }
            }
            this.WatchVideoProgress();
        }

        EuclidianDistance(x1, x2) {
            return Math.sqrt( (x1 - x2) * (x1 - x2) );
        }

        UpdateTrimInterval() {
            this.UpdateLocation();
            this.UpdateTrimIntervalByVideoId(this.location.videoId);
        }

        UpdateTrimIntervalByVideoId(videoId) {
            this.trimInterval =    this.config.list[videoId]
                                && this.config.list[videoId].trim;
        }

        GetInversedTrimInterval() {
            return this.trimInterval && this.trimInterval.map(x => this.InverseLinearFit(x))
                   || this.DEFAULT_VALUE;
        }

        LoadUI() {
            let injectionTarget;
            this.videoElement && !this.LinearFit && this.InitLinearFit();
            if (this.videoElement
                && this.LinearFit
                && !this.controls
                && (injectionTarget = document.getElementsByClassName("ytscript-panel-main")[0]))
            {
                let interval = this.GetInversedTrimInterval();

                this.controls = document.createElement("div");
                this.controls.className = "ytscript-controls-trim";

                let sliderContainer = document.createElement("div");

                this.inputs = document.createElement("div");
                this.inputs.className = "input-container";
                let leftHandleInput = document.createElement("input");
                let rightHandleInput = document.createElement("input");
                leftHandleInput.type = rightHandleInput.type = "text";

                this.inputs.appendChild(leftHandleInput);
                this.inputs.appendChild(rightHandleInput);

                this.SetHandles(interval);

                this.slider = new Slider(sliderContainer, {
                    className: "ytscript-slider-trim",
                    widjetOptions: {
                        min: this.DEFAULT_VALUE[0],
                        max: this.DEFAULT_VALUE[1],
                        values: interval,
                        range: true,
                        step: 0.1,
                        slide: (event, ui) => {
                            this.SetHandles(ui.values);
                        },
                        stop: this.IntervalConfirmed.bind(this)
                    }
                }).Initialize();

                let clearConfigButton = document.createElement("button");
                clearConfigButton.className = "ytscript-button";
                clearConfigButton.insertAdjacentHTML("beforeend", '<i class="fa fa-eraser"></i>');
                clearConfigButton.insertAdjacentText("beforeend", "Clear config");
                clearConfigButton.addEventListener("click", this.ClearConfig.bind(this));

                this.controls.appendChild(sliderContainer);
                this.controls.appendChild(this.inputs);
                this.controls.appendChild(clearConfigButton);

                injectionTarget.api.CreatePanelItem({
                    componentName: this.name,
                    componentIndex: this.index,
                    titleIconHtml: '<i class="fa fa-scissors"></i>',
                    contentNode: this.controls
                });
            }

            if (this.controls) {
                this.status.isUILoaded = true;
            }
        }

        SetHandles(values) {
            let [a, b] = this.inputs.children;
            [a.value, b.value] = values.map(x => Utils.SecondsToTimeString(this.LinearFit(x)));
        }

        IntervalConfirmed(event, ui) {
            let interval = ui.values.map(x => this.LinearFit(x));

            if (ui.values[0] === this.DEFAULT_VALUE[0] && ui.values[1] === this.DEFAULT_VALUE[1]) {
                delete this.config.list[this.location.videoId];
                this.trimInterval = undefined;
            }
            else {
                this.config.list[this.location.videoId] = { trim: interval };
                this.trimInterval = interval;
            }

            this.SaveConfig(this.config);
        }

        NavigateStartedToWatch(event) {
            this.location.videoId = this.ParseValueFromUrl(event.detail.url, "v");
            this.Update(this.location.videoId);
            this.status.isProcessed = true;
        }

        ProcessNavStartToBrowseImmediately(event) {
            const Callback = () => {
                this.player.pauseVideo();
                this.status.isVideoChanged = true;
                
                this.dispatchEvent(new CustomEvent(
                    this.events.onListenerRemove.eventName,
                    {
                        detail: {
                            eventTarget: this.videoElement,
                            eventName: "durationchange",
                            eventListener: Callback,
                            useCapture: false
                        }
                    }
                ));
            };
            this.videoElement.addEventListener("durationchange", Callback);
        }

        ProcessNavStartToBrowse(event, videoId) {
            if (this.status.isVideoChanged) {
                this.Update(videoId, this.SeekAndPlay.bind(this));
            }
            else {
                this.Update(videoId);
            }

            this.status.isProcessed = true;
            this.status.isVideoChanged = false;
        }

        Update(videoId, callback) {
            if (videoId) {
                this.UpdateTrimIntervalByVideoId(videoId);
            }
            else {
                this.UpdateTrimInterval();
            }
            this.UpdatePlayer(callback);
            this.UpdateUI();
        }
        
        UpdatePlayer(cb) {
            if (cb) {
                cb();

                return;
            }
            
            const events = [
                {
                    eventTarget: this.videoElement,
                    eventName: "durationchange",
                    useCapture: false
                },
                {
                    eventTarget: this.videoElement,
                    eventName: "loadedmetadata",
                    useCapture: false
                },
                {
                    eventTarget: this.videoElement,
                    eventName: "loadeddata",
                    useCapture: false
                }
            ];
            
            const Callback = () => {
                this.SeekAndPlay();

                for (const k of events) {
                    const { eventTarget, eventName, useCapture } = k;
                    
                    this.dispatchEvent(new CustomEvent(
                        this.events.onListenerRemove.eventName,
                        {
                            detail: {
                                eventTarget: eventTarget,
                                eventName: eventName,
                                eventListener: Callback,
                                useCapture: useCapture
                            }
                        }
                    ));
                }
            };
            
            for (const k of events) {
                const { eventTarget, eventName, useCapture } = k;
                eventTarget.addEventListener(eventName, Callback, useCapture);
            }
        }
        
        SeekAndPlay() {
            this.trimInterval && this.player.seekTo(this.trimInterval[0]);
            this.player.playVideo();
        }
        
        UpdateUI() {
            this.InitLinearFit();
            let interval = this.GetInversedTrimInterval();
            $(this.slider.api).slider("values", interval)
            this.SetHandles(interval);
        }

        YtNavigateFinished(event) {
            if (event.detail.pageType === "watch") {
                this.UpdateUI();
                if (!this.status.isProcessed) {
                    this.Update();
                }

                this.status.isProcessed = false;
            }
            else if (event.detail.pageType === "browse") {
                if (this.ParseValueFromUrl(event.detail.url, "list") !== ""
                && this.ParseValueFromUrl(event.detail.url, "playnext") !== "")
                {
                    this.Update();

                    this.status.isProcessed = false;
                }
            }
        }

        LoadConfig(data) {
            super.LoadConfig(data);
            this.config.list = this.config.list || {};
        }

        ClearConfig() {
            this.SaveConfig({ list: {} });
            this.UpdateTrimInterval();
            this.UpdateUI();
        }
    }

    class ScrollToCurrentVideoFix extends Component {
        constructor() {
            super();
        }

        IsValidLocation() {
            this.UpdateLocation();
            if (this.location.pageType === "watch" && this.location.url.indexOf("list=") !== -1) {
                return true;
            }
            else {
                return false;
            }
        }

        Load() {
            let manager;
            if (!this.playlistComponent
                && (manager = document.querySelector("yt-playlist-manager"))) {
                this.playlistComponent = manager.playlistComponent;

                let proto = this.playlistComponent && Object.getPrototypeOf(this.playlistComponent);

                proto && (proto.scrollToCurrentVideo_ = function () {
                    let items = this.$ && this.$.items;
                    let currentIndex = this.data && this.data.localCurrentIndex;
                    items && this.data && items.scrollToIndex(currentIndex);
                });
            }

            if (this.playlistComponent) {
                this.status.isLoaded = true;
            }
        }
    }



    manager.AddComponent(new NavigationManagerHack())
           .AddComponent(new ComponentPanel())
           .AddComponent(new TrimControl())
           .AddComponent(new VolumeControl())
           .AddComponent(new ScrollToCurrentVideoFix())
           .Initialize();
})();