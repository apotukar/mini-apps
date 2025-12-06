class LoginObservable {
  constructor() {
    this.observers = [];
  }

  addObserver(observer) {
    this.observers.push(observer);
  }

  async notifyAll(req, res, user) {
    for (const observer of this.observers) {
      await observer(req, res, user);
    }
  }
}

export const loginObservable = new LoginObservable();
