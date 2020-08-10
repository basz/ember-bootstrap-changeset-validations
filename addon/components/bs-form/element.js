import BsFormElement from 'ember-bootstrap/components/bs-form/element';
import { action, get } from '@ember/object';
import { dependentKeyCompat } from '@ember/object/compat';
import { isNone, typeOf } from '@ember/utils';

export default class BsFormElementWithChangesetValidationsSupport extends BsFormElement {
  '__ember-bootstrap_subclass' = true;

  // We convert
  //
  // `model.error.${this.property}.validation` which could be either a string or an array
  // see https://github.com/validated-changeset/validated-changeset/#error
  //
  // into
  //
  // Ember Bootstrap expects errors property of FormElement to be an array of validation messages:
  // see https://www.ember-bootstrap.com/api/classes/Components.FormElement.html#property_errors
  //
  // If the if the property is valid but no validation is present `model.error.[this.property] could also be undefined.
  @dependentKeyCompat
  get errors() {
    let errors = get(this, `model.error.${this.property}.validation`);

    // no messages
    if (isNone(errors)) {
      return [];
    }

    // a single messages
    if (typeOf(errors) === 'string') {
      return [errors];
    }

    // assume it's an array of messages
    return errors;
  }

  get hasValidator() {
    return typeof this.model?.validate === 'function';
  }

  // Ember Changeset does not validate the initial state. Properties are not
  // validated until they are set the first time. But Ember Bootstrap may show
  // validation results before the property was changed. We need to make sure
  // that changeset is validated at that time.
  // Ember Bootstrap may show the validation in three cases:
  // 1. User triggered one of the events that should cause validation errors to
  //    be shown (e.g. focus out) by interacting with the form element.
  //    Ember Bootstrap stores these state in `showOwnValidation` property of
  //    the form element.
  // 2. User submits the form. Ember Bootstrap will show validation errors
  //    for all form elements in that case. That state is handled by
  //    `showAllValidations` arguments passed to the form element.
  // 3. User passes in a validation error or warning explicilty using
  //    `customError` or `customWarning` arguments of the form element.
  // Ember Bootstrap ensures that the model is valided as part of its submit
  // handler. So we can assume that validations are run in second case. Ember
  // Bootstrap does not show the validation errors of the model but only the
  // custom error and warning if present. So it does not matter if initial
  // state is validated or not. That means we only have to handle the first
  // case.
  // Ember Bootstrap does not provide any API for validation plugins to support
  // these needs. We have to override a private method to run the validate
  // logic for now.
  @action
  async showValidationOnHandler(event) {
    let validationShowBefore = this.showOwnValidation;

    // run original implementation provided by Ember Bootstrap
    super.showValidationOnHandler(event);

    // run initial validation if
    //   - visibility of validations changed
    let canValidate = this.hasValidator && this.property;
    let validationVisibilityChanged = !validationShowBefore && this.showOwnValidation;
    if (canValidate && validationVisibilityChanged) {
      await this.model.validate(this.property);
    }
  }
}
