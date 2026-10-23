// jsdom has no modal dialogs: stand-ins that only open and close them (browsers also make the page
// behind inert). Call in beforeAll in tests that open a Dialog.
export function standInModalDialogs() {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}
