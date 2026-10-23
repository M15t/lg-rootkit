# Windows 7
Press Win + R and a pop up would show up

![here](a.png)

Type control and press ok in the pop up

This control panel would pop up

![here](b.png)

click here

After that it should look that :

![here](c.png)

Click Turn Windows Features On or Off

This pop up would open :

![here](d.png)

Make sure Internet Information Services is turn on

if not , turn that on.

After that click ok

If it ask you to reboot then click reboot

Open https://github.com/M15t/rootkit in your browser

![here](e.png)

Click here

You would see a pop up after clicking

![here](f.png)

Click that in the pop up

Download the pinned [Homebrew Channel v0.7.3 IPK](https://github.com/webosbrew/webos-homebrew-channel/releases/download/v0.7.3/org.webosbrew.hbchannel_0.7.3_all.ipk).
The screenshots below show an older upstream release page.


After that Click here

![here](g.png)

You would see this page

![here](h.png)

If you do then click here.

Your browser will be starting to download a ipk file

Check your download folder

![here](j.png)

You should have the IPK and the repository ZIP. No separate Telnet file is needed.

Before using the IPK, run `certutil -hashfile <downloaded-file.ipk> SHA256`.
The expected SHA-256 is
`d10bf3c753551d7c72fb7a92b20fcd2317e502a220ac668ba8e76f6ea78b363c`.
Stop if it does not match. The TV installer also verifies this hash before installation.

Rename the ipk file into hbc.ipk like so 

![here](k.png)

Open the zip file

![here](l.png)

Copy the folder getroot into C:\inetpub

![here](m.png)

Rename it into dualbro

![here](n.png)

Copy `hbc.ipk` into `C:\inetpub\dualbro\wtfbro\payload\`.
Ignore the Telnet file shown in the older screenshot.

![here](o.png)

Search iis 

![here](p.png)

Open it

After opening it then right on Sites like so :

![here](q.png)

Click Add Website 

This should pop up and fill in all the feild like so 

![here](r.png)

Click ok after that

you should smth like so :

![here](s.png)

Click Mine type 

![here](t.png)

Click Add

This should pop fill in the feild like so

![here](u.png)

Click ok

Click Add 

![here](t.png)


This should pop fill in the feild like so

![here](v.png)

Prass win + r 

Type cmd and click ok

![here](w.png)

Type ipconfig

![here](x.png)

as you can see the pc ip is 172.16.0.243

Prass win + r

Type notepad

![here](y.png)

Notepad would show up

click ctrl + o

![here](z.png)

go to C:/inetpub/dualbro and click all files in file type

Select offline.json file

Set the file contents to `{"offlinemode":true}`. The launcher uses its own
server address for the payload; `offlinemodeip` in the older screenshot is ignored.

![here](aa.png)

click ctrl +s to save 


