module.exports = {
    isRequestFromServer: context => {
        return !((context.params || {}).provider);
    }
};
