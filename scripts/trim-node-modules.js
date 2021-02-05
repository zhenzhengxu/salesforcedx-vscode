const rimraf = require('rimraf');

rimraf('packages/salesforcedx-*/node_modules/jsforce/build', function(error) {
  if (error) {
    throw error;
  }
});
