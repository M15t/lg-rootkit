# msys
Install msys2

Open msys2

Run those command as below :

(See [here](https://stackoverflow.com/questions/53988638/git-fatal-protocol-https-is-not-supported) if you have issue on copy and paste.)

```
pacman -S  python git which

git clone https://github.com/exkc/e.nya.je.git

cd e.nya.je/getroot/offline

chmod +x setup.sh


```

Prass win + r 

Type cmd and click ok

![here](a.png)

Type ipconfig

![here](b.png)

as you can see the pc ip is 172.16.0.243

Click on the msys2 window

 and run

 ```

 ./setup.sh

 ```

Type the ip you got from `ifconfig` when it asked `What is the ip/local network domain of this device :`
