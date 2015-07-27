var through = require('through2'),
  gutil = require('gulp-util'),
  https = require('https');

module.exports = function(opts) {
  opts                 = opts || {};
  opts.url             = opts.url || '';
  opts.tag             = opts.tag || 'head';
  opts.uid             = opts.uid || '';
  opts.anonymizeIp     = opts.anonymizeIp     === false ? false : true;
  opts.demographics    = opts.demographics    === true  ? true  : false;
  opts.linkAttribution = opts.linkAttribution === true  ? true  : false;
  opts.removeRefSpam   = opts.removeRefSpam   === true  ? true  : false;

  return through.obj(function(file, enc, cb) {
    if(file.isNull()) return cb(null, file);
    if(file.isStream()) return cb(new Error('gulp-ga: streams not supported'))

    var ga = "  <script>\n";
    ga += "      (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){\n" +
        "      (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),\n" +
        "      m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)\n" +
        "      })(window,document,'script','//www.google-analytics.com/analytics.js','ga');\n" +
        "\n" +
        "      ga('create', '" + opts.uid + "', '" + opts.url + "');\n";

        if(opts.removeRefSpam) {
          ga += "      if(isNotSpammer())ga('send', 'pageview');\n";
        } else {
          ga += "      ga('send', 'pageview');\n";
        }
        ga += "      ga('set', 'anonymizeIp'," + opts.anonymizeIp + ");\n";
    if(opts.demographics)   { ga += "      ga('require', 'displayfeatures');\n"; }
    if(opts.linkAttribution){ ga += "      ga('require', 'linkid', 'linkid.js');\n"; }
    if(opts.bounceTime > 1) { ga += "      setTimeout(\"ga('send', 'event', 'read', '" + opts.bounceTime + " seconds')\"," +  opts.bounceTime + "000);\n"; }

    if(opts.removeRefSpam) {
      getSpamReferrers(function(refs) {
        ga += "function isNotSpammer(){";
        ga += "  if(!document.referrer) return true;";
        ga += "  var ref=document.referrer.toLowerCase();";
        ga += "  return "+refs+".every(function(el){";
        ga += "    return el.indexOf(ref) === -1;";
        ga += "  })";
        ga += "}";

        ga += "    </script>\n  </" + opts.tag + ">\n";

        var content = file.contents.toString();

        content = content.replace('<\/' + opts.tag + '>', ga);
        file.contents = new Buffer(content);
        cb(null, file);
      });
    } else {
      ga += "    </script>\n  </" + opts.tag + ">\n";

      var content = file.contents.toString();
      content = content.replace('<\/' + opts.tag + '>', ga);
      file.contents = new Buffer(content);
      cb(null, file);
    }
  });
};

// make string representation of array of spam referrers to inject into page
function getSpamReferrers(callback) {
  getSpammersTxt(function(data) {
    var referrerArrayAsString = data.split('\n').join("','").slice(0, -3);

    callback("['" + referrerArrayAsString + "']");
  });
}

// get list of latest ga referrer spammers
function getSpammersTxt(callback) {
  var options = {
    host: 'raw.githubusercontent.com',
    port: 443,
    path: '/piwik/referrer-spam-blacklist/master/spammers.txt'
  };

  https.get(options, function(response) {
    var txt = '';
    response.on('data', function(chunk) {
      txt += chunk;
    });

    response.on('end', function() {
      callback(txt);
    });
  }).on('error', function(e) {
    console.log('Could not get referrer list: ' + e.message);
    callback('');
  });
}
