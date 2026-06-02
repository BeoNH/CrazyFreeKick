import { Component } from "cc";

class BroadcastListener {
    action: string;
    target: Component;
    callback: (data: any) => void;

    constructor(action: string, callback: (data: any) => void, target: Component) {
        this.action = action;
        this.target = target;
        this.callback = callback;
    }
}

export default class BroadcastReceiver {
    private static listeners: Array<BroadcastListener> = new Array<BroadcastListener>();

    public static register(action: string, callback: (data: any) => void, target: Component) {
        this.listeners.push(new BroadcastListener(action, callback, target));
    }

    public static unRegisterByAction(action: string) {
        for (var i = 0; i < this.listeners.length; i++) {
            if (this.listeners[i].action == action) {
                this.listeners.splice(i--, 1);
            }
        }
    }

    public static unRegisterByTarget(target: Component) {
        for (var i = 0; i < this.listeners.length; i++) {
            if (this.listeners[i].target == target) {
                this.listeners.splice(i--, 1);
            }
        }
    }
    

    public static send(action: string, data: any = null) {
        for (var i = 0; i < this.listeners.length; i++) {
            let listener = this.listeners[i];
            if (listener.target && listener.target instanceof Object && listener.target.node) {
                if (listener.action == action) {
                    listener.callback(data);
                }
            } else {
                this.listeners.splice(i--, 1);
            }
        }
    }
}