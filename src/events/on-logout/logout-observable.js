class LogoutObservable {
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

export const logoutObservable = new LogoutObservable();
