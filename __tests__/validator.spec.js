const feathersHooksCommon = require('../src/isRequestFromServer');
jest.mock('../src/isRequestFromServer');

feathersHooksCommon.isRequestFromServer.mockImplementation(() => false);

const validator = require('../src/validator');

const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    NORMAL_USER: 'admin'
};

const Ajv = require('ajv');
const ajv = new Ajv({
    useDefaults: true,
    removeAdditional: 'all',
    passContext: true,
    coerceTypes: true,
    $data: true,
    jsonPointers: true
});

const schemas = {
    before: {
        create: {
            all: {
                type: 'object',
                properties: {
                    propA: {
                        type: 'string'
                    }
                }
            },
            [USER_ROLES.SUPER_ADMIN]: {
                type: 'object',
                properties: {
                    propB: {
                        type: 'string'
                    }
                }
            }
        },
        patch: {
            [USER_ROLES.SUPER_ADMIN]: {
                type: 'object',
                properties: {
                    propA: {
                        type: 'string'
                    },
                    propB: {
                        type: 'string'
                    }
                }
            }
        }
    },
    after: {
        all: {
            all: {
                type: 'object',
                properties: {
                    propA: {
                        type: 'string'
                    }
                }
            }
        },
        create: {
            [USER_ROLES.SUPER_ADMIN]: {
                type: 'object',
                properties: {
                    propB: {
                        type: 'string'
                    }
                }
            }
        },
        patch: {
            [USER_ROLES.SUPER_ADMIN]: context => {
                return {
                    type: 'object',
                    properties: {
                        propB: {
                            type: 'string'
                        },
                        [context.result.contextPropLabel]: {
                            type: 'string'
                        }
                    }
                };
            },
            [USER_ROLES.NORMAL_USER]: context => {
                return Promise.resolve({
                    type: 'object',
                    properties: {
                        propB: {
                            type: 'string'
                        },
                        [context.result.contextPropLabel]: {
                            type: 'string'
                        }
                    }
                });
            }
        }
    }
};

const defaults = {
    [USER_ROLES.SUPER_ADMIN]: context => {
        return {
            userProp: context.params.user.userProp
        };
    }
};

describe('validator', function() {
    describe('validateSchema', function() {
        it('should validate result in after hook', async function() {
            const context = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'create',
                path: 'service',
                type: 'after',
                result: {
                    propA: 'hello',
                    propB: 'there',
                    extraProp: 'extra'
                }
            };

            const expectedResult = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'create',
                path: 'service',
                type: 'after',
                result: {
                    propA: 'hello',
                    propB: 'there'
                }
            };

            const validatorFn = validator.schemaValidator(schemas, 'service', ajv);
            expect(await validatorFn(context)).toEqual(expectedResult);
        });

        it('should validate data in before hook if user is not present', async function() {
            const context = {
                params: {},
                method: 'create',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there',
                    extraProp: 'extra'
                }
            };

            const expectedResult = {
                params: {},
                method: 'create',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello'
                }
            };

            const validatorFn = validator.schemaValidator(schemas, 'service', ajv);
            expect(await validatorFn(context)).toEqual(expectedResult);
        });

        it('should validate data in before hook', async function() {
            const context = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'create',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there',
                    extraProp: 'extra'
                }
            };

            const expectedResult = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'create',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there'
                }
            };

            const validatorFn = validator.schemaValidator(schemas, 'service', ajv);
            expect(await validatorFn(context)).toEqual(expectedResult);
        });

        it('should validate result in after hook when validation schema is a function', async function() {
            const context = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'patch',
                path: 'service',
                type: 'after',
                result: {
                    propA: 'hello',
                    propB: 'there',
                    contextPropLabel: 'contextProp',
                    contextProp: 'contextProp'
                }
            };

            const expectedResult = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'patch',
                path: 'service',
                type: 'after',
                result: {
                    propA: 'hello',
                    propB: 'there',
                    contextProp: 'contextProp'
                }
            };

            const validatorFn = validator.schemaValidator(schemas, 'service', ajv);
            expect(await validatorFn(context)).toEqual(expectedResult);
        });

        it('should validate result in after hook when validation schema is an async function (returns promise)', async function() {
            const context = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.NORMAL_USER
                    }
                },
                method: 'patch',
                path: 'service',
                type: 'after',
                result: {
                    propA: 'hello',
                    propB: 'there',
                    contextPropLabel: 'contextProp',
                    contextProp: 'contextProp'
                }
            };

            const expectedResult = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.NORMAL_USER
                    }
                },
                method: 'patch',
                path: 'service',
                type: 'after',
                result: {
                    propA: 'hello',
                    propB: 'there',
                    contextProp: 'contextProp'
                }
            };

            const validatorFn = validator.schemaValidator(schemas, 'service', ajv);
            expect(await validatorFn(context)).toEqual(expectedResult);
        });
    });

    describe('validateSchemaAndSetDefaults', function() {
        it('should validate and not set defaults for non-create method', async function() {
            const context = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'patch',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there',
                    extraProp: 'extra'
                }
            };

            const expectedResult = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'patch',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there'
                }
            };

            const validatorFn = validator.validateSchemaAndSetDefaults(
                schemas,
                defaults,
                'service',
                ajv
            );
            expect(await validatorFn(context)).toEqual(expectedResult);
        });

        it('should validate and set defaults in create method', async function() {
            const context = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'create',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there',
                    extraProp: 'extra'
                }
            };

            const expectedResult = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'create',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there',
                    userProp: 'userProp'
                }
            };

            const validatorFn = validator.validateSchemaAndSetDefaults(
                schemas,
                defaults,
                'service',
                ajv
            );
            expect(await validatorFn(context)).toEqual(expectedResult);
        });

        it('should validate and override passed in values with defaults in create method', async function() {
            const context = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'create',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there',
                    extraProp: 'extra',
                    userProps: 'passedByClient'
                }
            };

            const expectedResult = {
                params: {
                    user: {
                        userProp: 'userProp',
                        role: USER_ROLES.SUPER_ADMIN
                    }
                },
                method: 'create',
                path: 'service',
                type: 'before',
                data: {
                    propA: 'hello',
                    propB: 'there',
                    userProp: 'userProp'
                }
            };

            const validatorFn = validator.validateSchemaAndSetDefaults(
                schemas,
                defaults,
                'service',
                ajv
            );
            expect(await validatorFn(context)).toEqual(expectedResult);
        });
    });
});
