const DEFAULT_DELAY = 300;

export const sleep = (ms = DEFAULT_DELAY) => new Promise((resolve) => setTimeout(resolve, ms));

export const createSuccess = (data, message = 'Success') => ({
    code: 1,
    data,
    message
});

export const createError = (message = 'Something went wrong') => ({
    code: 2,
    message
});

export const withMockResponse = async (handler, options = {}) => {
    const { delay = DEFAULT_DELAY, shouldFail = false, errorMessage = 'Unable to process request' } = options;
    await sleep(delay);

    if (shouldFail) {
        return createError(errorMessage);
    }

    return createSuccess(handler());
};
