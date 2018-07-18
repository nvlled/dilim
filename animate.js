let util = require("./util");

let animationEnd = (function (el) {
    var animations = {
        animation: 'animationend',
        OAnimation: 'oAnimationEnd',
        MozAnimation: 'mozAnimationEnd',
        WebkitAnimation: 'webkitAnimationEnd',
    };

    for (let t in animations) {
        if (el.style[t] !== undefined) {
            return animations[t];
        }
    }
})(document.body);

let endSym = Symbol("animate end");
let nameSym = Symbol("animation names");
let animate = (el, ...names)  => {
    if (typeof el == "string") {
        el = document.querySelector(el);
    }

    if (el[endSym]) {
        console.log("removing existing animation");
        el.removeEventListener(animationEnd, el[endSym]);
        for (let name of el[nameSym] || [])
            el.classList.remove(name);
    }

    el.classList.add("animated");
    for (let name of names)
        el.classList.add(name);
    console.log("animating", names, el);

    return new Promise((resolve, reject) => {
        let handler = e => {
            el.removeEventListener(animationEnd, handler);
            el[endSym] = null;
            el[nameSym] = null;
            resolve();
            el.classList.remove("animated");
            for (let name of names)
                el.classList.remove(name);
        };
        el.addEventListener(animationEnd, handler);
        el[endSym] = handler;
        el[nameSym] = names;
    });
}

module.exports = animate;