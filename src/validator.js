const util = require('util');
const { each, isFunction, get, isEmpty } = require('lodash');
const deepmerge = require('deepmerge');
const isRequestFromServer = require('./isRequestFromServer').isRequestFromServer;
let compiledSchemas = {};

function schemaValidator(allSchemas, serviceName, ajv) {
    if (isEmpty(allSchemas)) {
        throw new Error(`No schema definition provided for service: ${serviceName}`);
    }

    if (isEmpty(serviceName)) {
        throw new Error(`No service name provided from schema: ${util.inspect(allSchemas)}`);
    }

    each(allSchemas, (schemas, type) => {
        each(schemas, (schemas, method) => {
            each(schemas, (schema, userRole) => {
                const schemaKey = `${serviceName}:${type}:${method}:${userRole}`;
                compiledSchemas[schemaKey] = schema;
            });
        });
    });

    return async context => {
        if (!isRequestFromServer(context)) {
            let validator, validationResult;

            const { method, path, params, data, type, result, id } = context;
            let { user } = params;

            user = user || {};

            const isSelf = user._id && user._id.toString() === id;

            const allAllSchema = compiledSchemas[`${path}:${type}:all:all`];
            const allForUserRoleSchema =
                compiledSchemas[`${path}:${type}:all:${user.role}`];
            const allUserRoleForMethodSchema =
                compiledSchemas[`${path}:${type}:${method}:all`];
            const forMethodAndUserSchema =
                compiledSchemas[`${path}:${type}:${method}:${user.role}`];

            const schemas = [
                allAllSchema,
                allForUserRoleSchema,
                allUserRoleForMethodSchema,
                forMethodAndUserSchema
            ];

            const resolvedSchemas = await Promise.all(schemas.map((schema) => {
                return isFunction(schema) ? schema(context, isSelf) : schema;
            }));

            let schema = resolvedSchemas.reduce((result, schema) => {
                if (!schema) {
                    return result;
                }
                return deepmerge(
                    result,
                    schema
                );
            }, {});


            if (!isEmpty(schema)) {

                // fixes async in sync schema error
                schema = deepmerge(schema, { "$async": true });
                validator = ajv.compile(schema);

                try {
                    if (method === 'find' && type === 'after') {
                        const length = result.data.length;
                        let data = result.data;
                        for(let i=0; i<length; i++) {
                            if (!await validator.call(user, data[i])) {
                                throw validator;
                            }
                        }
                        validationResult = true;
                    } else {
                        validationResult = await validator.call(
                            user,
                            type === 'before' ? data : result
                        );
                    }
                    if (!validationResult) {
                        throw validator;
                    }
                } catch (e) {
                    throw new Error(JSON.stringify(e.errors));
                }
            }
        }

        return context;
    };
}

function setDefaults(defaults) {
    return async context => {
        const { method, params, data, type } = context;
        let { user } = params;

        if (
            method !== 'create' ||
            type !== 'before' ||
            isRequestFromServer(context) ||
            !user
        ) {
            return context;
        }

        const defaultFn = get(defaults, `${user.role}`);

        if (defaultFn) {
            context.data = deepmerge(data, await defaultFn(context));
        }

        return context;
    };
}

function validateSchemaAndSetDefaults(schemas, defaults, serviceName, ajv) {
    const validatorFn = schemaValidator(schemas, serviceName, ajv);
    const setDefaultFn = setDefaults(defaults);

    return async function(context) {
        return await setDefaultFn(await validatorFn(context));
    };
}

module.exports = {
    schemaValidator,
    setDefaults,
    validateSchemaAndSetDefaults
};
