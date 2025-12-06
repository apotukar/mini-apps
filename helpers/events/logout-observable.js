class LogoutObservable {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    this.observers.push(observer);
  }

  async notify(ctx) {
    for (const observer of this.observers) {
      await observer(ctx);
    }
  }
}

export const logoutObservable = new LogoutObservable();
