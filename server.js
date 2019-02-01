const express = require('express');
const fs=require('fs');
const crypto=require('crypto');
const auth = require('http-auth');
const app = express();
const config=require(process.env.NODE_ENV=='prod' || process.argv.indexOf('--prod')>=0?('./config_prod'):'./config');
const port = 3000;

app.use(express.urlencoded({extended: true}));

// You can generate password hash using

app.use('/admin/*',auth.connect(auth.basic({realm:"Admin Area"},(username, password, callback)=>{
    // Custom authentication
    // Use callback(error) if you want to throw async error.
    callback(
        config.admin.user === username &&
        crypto.createHmac('sha256',config.secert).update(password).digest('hex') === config.admin.password_hash
    );
})));



const mysql=require('mysql').createPool({
    connectionLimit : 2,
    host     : config.db.host,
    user     : config.db.user,
    port     : config.db.port,
    password : config.db.password,
    database : config.db.database
});


app.get("/", function(req, res) {
    res.send(fs.readFileSync('web/index.html').toString('utf-8').replace(/YOUR_PUBLIC_KEY/g,config.notifications.public_key));
});

app.get("/admin/", function(req, res) {
    mysql.query('SELECT count(id) as count FROM push_subscribers', function (error, results, fields) {
        res.send(
            fs.readFileSync('web/admin/index.html').toString('utf-8')
            .replace(/YOUR_PUBLIC_KEY/g, config.notifications.public_key)
            .replace(/{number}/g, error?error.toString():results[0].count)
        );
    });
});


app.post('/subscribe', (req, res) => {
    // lets save all subscriptions in plain-text file.
    if(req.body.subscription){
        let subscription=req.body.subscription;
        let timezone=req.body.timezone;

        var id=crypto.createHmac('sha256', 'one_time_secret').update(subscription).digest('hex');

        mysql.query('SELECT id from push_subscribers WHERE  id=?',[id], function (error, results, fields) {
            if (error || results.length)
                console.error(error || 'already subscribed') || res.send('ERROR');
            else
                mysql.query('INSERT INTO push_subscribers SET ?',{
                    id:id,
                    subscription:subscription,
                    timezone_offset:timezone,
                    ip:(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']) || req.connection.remoteAddress,
                    country:req.headers['cf-ipcountry'],
                },(error, result)=>{
                    if (error)
                        console.error(error) || res.send('ERROR');
                    else
                        res.send('OK');
                });
        });
    } else
        res.send('Invalid Parameters');
});


const webpush = require('web-push');
const async = require('async');
webpush.setVapidDetails(
    'mailto:'+config.notifications.email,
    config.notifications.public_key,
    config.notifications.private_key
);

app.post('/admin/send', (req, res) => {
    if(req.body.title && req.body.notification){
        if(req.body.preview)
            webpush.sendNotification(JSON.parse(req.body.preview), JSON.stringify({
                title:req.body.title,
                notification:req.body.notification,
                url:req.body.url,
            })).then((r)=>{
                res.send('Sending Notifications to you.');
            }).catch((ee)=>{
                res.send('ERROR: '+ee.toString());
                console.error(ee);
            });
        else
            mysql.query('SELECT id,subscription from push_subscribers ', function (error, results, fields) {
                if (error || results.length==0)
                    console.error(error) && res.send(error?"DB ERROR":'NO SUBSCRIBERS');
                else {
                    res.send('Sending Notifications to '+(results.length)+' subscribers.');
                    // now lest send them all in background
                    let success=0,failed=0;


                    async.eachSeries(results,(item, callback)=>{
                        webpush.sendNotification(JSON.parse(item.subscription), JSON.stringify({
                            title:req.body.title,
                            notification:req.body.notification,
                            url:req.body.url,
                        })).then((r)=>{
                            success++;
                        }).catch((ee)=>{
                            failed++;
                            console.log('ERROR: '+ee.toString());
                            console.error(ee);
                        }).finally(()=>{
                            callback(null,true);
                        });
                    },()=>{
                        console.log("PUSH NOTIFICATIONS SENT: success:"+success+' failed:'+failed);
                    });
                }
            });
    } else res.send('Invalid Parameters');
});



app.use(express.static('web'));

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`)
});
