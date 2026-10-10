# -*- coding: utf-8 -*-
import os, shutil, io
root = r'D:\myAIprojects\try_doubao\xianxia-grad-game'
site = os.path.join(root, '_site')
if os.path.isdir(site): shutil.rmtree(site)
os.makedirs(site)
# 需要发布的顶层文件与目录
for f in ['index.html', '研途问道.html']:
    shutil.copy2(os.path.join(root, f), os.path.join(site, f))
for d in ['assets', 'functions']:
    shutil.copytree(os.path.join(root, d), os.path.join(site, d))
# 统计
nfiles = sum(len(fs) for _, _, fs in os.walk(site))
print('staged files:', nfiles)
print('top:', os.listdir(site))
