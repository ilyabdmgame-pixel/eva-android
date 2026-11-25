package ru.eva.envtest;

import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.HashSet;
import java.util.Set;
import java.util.Random;

public final class PetPlayTest {
    private static void check(boolean pass,String message){if(!pass)throw new AssertionError(message);}

    private static void checkReactions(){
        PetMood mood=new PetMood(new Random(44));
        long start=20000;
        mood.beginMotion(start);
        mood.scene(false);
        mood.play(PetPlay.Act.THROW,450,PetMood.Cue.NONE,0);
        check(mood.quip==null,"An unprompted toss should not greet an imaginary touch");
        mood.play(PetPlay.Act.THROW,750,PetMood.Cue.NONE,0);
        check(mood.face==PetMood.Face.FOCUS,"A toss starts with a deliberate look");
        mood.play(PetPlay.Act.THROW,1670,PetMood.Cue.ICON,150);
        check(mood.face==PetMood.Face.WRY&&mood.weight>.9f,"A real tile rebound gets the wry reaction");

        mood.clear();
        mood.scene(true);
        mood.beginMotion(start);
        mood.play(PetPlay.Act.DRIBBLE,50,PetMood.Cue.NONE,0);
        String opening=mood.quip;
        check(member(PetRemarks.Moment.TOUCH,opening),"A long press gets a personal retort");
        mood.play(PetPlay.Act.DRIBBLE,950,PetMood.Cue.BOUNCE,150);
        check(opening.equals(mood.quip),"An impact cannot clip a line mid-sentence");
        mood.play(PetPlay.Act.DRIBBLE,2460,PetMood.Cue.ICON,330);
        String rebound=mood.quip;
        check(member(PetRemarks.Moment.ICON,rebound),"The icon supplies its own line after the touch quip");
        for(int t=2500;t<=3780;t+=40){
            mood.play(PetPlay.Act.DRIBBLE,t,PetMood.Cue.KICK,t%200);
            mood.updateCaption(start+t);
            check(rebound.equals(mood.quip),"A burst of kicks must not replace or restart the displayed line");
        }
        check(mood.face==PetMood.Face.PLEASED,"A kick still animates Eva's face while another caption is up");
        mood.play(PetPlay.Act.DRIBBLE,5000,PetMood.Cue.KICK,2100);
        check(mood.face==PetMood.Face.NEUTRAL,"An old cue must not leave a stuck expression");
        mood.endGame();
        mood.updateCaption(start+5000);
        check(mood.quip==null,"A stationary avatar must clear the caption after its reading time");

        start+=9000;
        mood.beginMotion(start);
        mood.motion(PetMotion.LANDING,125,.45f);
        check(mood.face==PetMood.Face.NEUTRAL&&mood.quip==null,"An ordinary landing stays calm");
        start+=1000;
        mood.beginMotion(start);
        mood.motion(PetMotion.LANDING,125,.84f);
        check(mood.face==PetMood.Face.SURPRISED&&member(PetRemarks.Moment.HARD_LANDING,mood.quip),
            "A hard landing deserves a startled expression and a situational line");
        String landing=mood.quip;
        mood.beginMotion(start+670);
        mood.motion(PetMotion.HOME_WALK,0,.45f);
        long untilFade=mood.updateCaption(start+900);
        check(landing.equals(mood.quip)&&mood.quipWeight==1&&untilFade>400,
            "A short animation should keep its caption readable during the next state");
        check(mood.updateCaption(start+941)==0,"Active movement must not enqueue duplicate caption wakeups");
        mood.updateCaption(start+3500);
        check(mood.quip==null,"End-of-caption invalidation must remove the final line");

        PetRemarks remarks=new PetRemarks(new Random(3));
        Set<String> all=new HashSet<>();
        for(PetRemarks.Moment moment:PetRemarks.Moment.values()){
            check(moment.lines.length>=100,"Too few distinct remarks for "+moment);
            String last=null;
            for(int cycle=0;cycle<3;cycle++){
                Set<String> drawn=new HashSet<>();
                for(int j=0;j<moment.lines.length;j++){
                    String line=remarks.draw(moment);
                    check(drawn.add(line)&&!line.equals(last),"Shuffle duplicated a line for "+moment);
                    if(cycle==0)check(all.add(line),"Duplicate text in two unrelated situations: "+line);
                    last=line;
                }
            }
        }
        for(PetPlay.Act act:PetPlay.Act.values()){
            start+=8000;
            mood.beginMotion(start);
            mood.scene(false);
            long beat=act.signatureMillis+40;
            mood.play(act,beat,PetMood.Cue.NONE,0);
            check(member(PetRemarks.Moment.valueOf(act.name()),mood.quip),"Missing act-specific remark for "+act);
        }
        int[] modes={PetMotion.LADDER_UP,PetMotion.MANTLE_UP,PetMotion.MANTLE_DOWN,PetMotion.ROPE_DOWN,
            PetMotion.EDGE_LEAN,PetMotion.PERCH_LOOK,PetMotion.CRAWLING,PetMotion.SEATED_PEEK,
            PetMotion.IDLE_BOOK,PetMotion.IDLE_TEA,PetMotion.IDLE_YAWN,PetMotion.GREET};
        PetRemarks.Moment[] moments={PetRemarks.Moment.LADDER,PetRemarks.Moment.MANTLE,PetRemarks.Moment.DESCENT,
            PetRemarks.Moment.ROPE,PetRemarks.Moment.EDGE,PetRemarks.Moment.EDGE,PetRemarks.Moment.CRAWL,
            PetRemarks.Moment.SEAT,PetRemarks.Moment.BOOK,PetRemarks.Moment.TEA,PetRemarks.Moment.YAWN,
            PetRemarks.Moment.GREET};
        for(int i=0;i<modes.length;i++){
            start+=8000;
            mood.beginMotion(start);
            int cue=modes[i]==PetMotion.CRAWLING?PetMotion.CRAWL_FOLD_MS+200:420;
            mood.motion(modes[i],cue,.3f);
            String actual=mood.quip;
            check(member(moments[i],actual),"Wrong event for motion "+modes[i]);
            mood.updateCaption(start+cue+4000);
            mood.motion(modes[i],cue+4100,.3f);
            check(mood.quip==null,"A long motion must not restart its remark once it is read");
        }
        System.out.println("Reactions: "+all.size()+" phrases, "+PetRemarks.Moment.values().length+
            " situations, caption timing and three shuffle cycles checked");
    }

    private static boolean member(PetRemarks.Moment moment,String line){
        return java.util.Arrays.asList(moment.lines).contains(line);
    }

    private static void verifyArms(){
        PetPlay.Pose p=new PetPlay.Pose();
        PetMood mood=new PetMood();
        for(PetPlay.Act act:PetPlay.Act.values()){
            for(int t=0;t<=act.duration;t+=8){
                PetPlay.sample(p,act,t);
                checkFold(p);
                boolean throwing=act==PetPlay.Act.THROW||act==PetPlay.Act.PLANE;
                if(act!=PetPlay.Act.SMOKE&&act!=PetPlay.Act.HEADPHONE_CHECK&&!throwing)check(p.upperDepth==1&&p.foreDepth==1,"Previous gesture altered another sleeve");
                if(throwing&&t<act.release)check(p.worldHandX()+(act==PetPlay.Act.PLANE?37:31)<=402,
                    "Held prop clipped before leaving the hand");
                if(act==PetPlay.Act.SMOKE)checkMouthApproach(p);
            }
        }
        for(int mode:new int[]{PetMotion.IDLE_YAWN,PetMotion.GREET,PetMotion.STRETCHING,PetMotion.IDLE_WINK}){
            int duration=PetMotion.duration(mode);
            for(int t=0;t<=duration;t+=8){
                PetGesture.sample(p,mode,t,duration,mood);
                checkFold(p);
                if(mode==PetMotion.IDLE_YAWN)checkMouthApproach(p);
                else check(p.upperDepth==1&&p.foreDepth==1,"Previous reach distorted the following gesture");
            }
        }
        for(PetPlay.Act act:new PetPlay.Act[]{PetPlay.Act.PLANE,PetPlay.Act.THROW}){
            PetPlay.sample(p,act,780);
            float windX=p.worldHandX(),windY=p.worldHandY();
            PetPlay.sample(p,act,act.release);
            check(windY<PetRig.SHOULDER_Y&&p.worldHandX()>windX+48,"Release should extend from the raised throwing arm");
        }
    }

    private static void checkFold(PetPlay.Pose p){
        for(boolean near:new boolean[]{false,true}){
            float depth=near?p.upperDepth:1,upper=near?p.upper():p.upperFar(),lower=near?p.near:p.far;
            float shoulder=near?PetRig.NEAR_SHOULDER_X:PetRig.FAR_SHOULDER_X;
            float ex=PetRig.elbowX(near,upper,depth),ey=PetRig.elbowY(near,upper,depth);
            float direction=(float)Math.toDegrees(Math.atan2(shoulder-ex,ey-PetRig.SHOULDER_Y));
            check(Math.abs(lower-direction)<=162,"Forearm folds through the upper arm");
        }
    }

    private static void checkMouthApproach(PetPlay.Pose p){
        float elbow=PetRig.elbowX(true,p.upper(),p.upperDepth);
        check(elbow>=PetRig.NEAR_SHOULDER_X-9&&p.handX()>=193&&p.foreDepth>=.65f,
            "Elbow crossed the chest or the hand took a detour around the opposite shoulder");
    }

    private static void checkNewBeats(){
        PetPlay.Pose p=new PetPlay.Pose();
        for(PetPlay.Act act:PetPlay.Act.values()){
            PetPlay.sample(p,act,act.duration);
            check(p.near==0&&p.far==0&&p.lean==0&&p.shift==0&&p.sink==0&&p.reveal==0,
                "Every action returns to the common stance before the next scene: "+act);
            PetPlay.sample(p,act,act.signatureMillis);
            check(p.reveal>.7f||act.release!=0,"Caption should coincide with the visible action: "+act);
            if(act==PetPlay.Act.BROOM_GUITAR){
                float stringsX=p.farHandX()+PetRig.rotateX(0,134,p.propAngle);
                float stringsY=p.farHandY()+PetRig.rotateY(0,134,p.propAngle);
                check(Math.hypot(stringsX-p.handX(),stringsY-p.handY())<43,"Strum at the bristles");
            }else if(act==PetPlay.Act.HEADPHONE_CHECK){
                check(Math.hypot(p.handX()-244,p.handY()-142)<17,"Place fingers on the ear cup");
            }else if(act==PetPlay.Act.BOW){
                check(p.bodyDepth<.87f&&p.sink>10,"Fold the torso over the planted feet");
            }else if(act==PetPlay.Act.SNEEZE){
                check(Math.hypot(PetRig.elbowX(true,p.upper(),1)-212,
                    PetRig.elbowY(true,p.upper(),1)-149)<28,"Sneeze into the raised sleeve");
            }else if(act==PetPlay.Act.TORCH_SIGNAL){
                check(p.accent>.65f,"Caption lands on the second torch signal");
            }
        }
    }

    public static void main(String[] args){
        verifyArms();
        checkNewBeats();
        PetPlay scenes=new PetPlay(new Random(38));
        EnumSet<PetPlay.Act> seen=EnumSet.noneOf(PetPlay.Act.class);
        PetPlay.Pose pose=new PetPlay.Pose();
        PetPlay.Act previous=null;
        int count=PetPlay.Act.values().length;
        for(int i=0;i<2*count;i++){
            if(i==count)seen.clear();
            PetPlay.Act act=scenes.next(i%2==0);
            check(seen.add(act)&&act!=previous,"Every scene must play before recycling");
            previous=act;
            PetPlay.sample(pose,act,0);
            check(pose.near==0&&pose.far==0&&pose.lean==0,"A scene must begin in the common stance");
            PetPlay.sample(pose,act,1320);
            check(pose.near!=0&&Float.isFinite(pose.handX()+pose.handY()),"Each act must have its own animated gesture");
        }

        PetRig.Knee far=new PetRig.Knee(),near=new PetRig.Knee();
        PetRig.knee(far,182,321,184,488,false);
        PetRig.knee(near,220,321,220,488,true);
        check(far.x<182&&near.x>220&&far.y>321&&near.y<488,
            "The knees must fold outwards independently over their planted ankles");
        check(PetRig.elbowY(true,0,1)==PetRig.ELBOW_Y&&
            PetRig.elbowY(true,PetRig.upperArm(-110),1)<PetRig.ELBOW_Y,
            "Reaching must articulate the shoulder as well as the elbow");
        PetPlay.sample(pose,PetPlay.Act.SMOKE,1690);
        check(Math.abs(pose.handX()-222.5f)<2&&Math.abs(pose.handY()-149)<2,
            "The near hand must bring the cigarette to the lip");
        check(pose.accent==0,"Exhaled smoke must appear after the hold");
        PetPlay.sample(pose,PetPlay.Act.SMOKE,2850);
        check(pose.accent>.8f&&pose.handY()>240,"The puff rises as the hand lowers");
        checkReactions();

        PetTurn turning=new PetTurn(300,220,1000,400,0,PetGravity.RIGHT);
        check(turning.angle(0,1000)==0&&turning.angle(1000,1000)==-90,"The turn must match both orientations");
        check(turning.angle(250,1000)<0&&turning.angle(500,1000)==-45&&turning.angle(750,1000)>-90,
            "The turn must render in-between poses in flight");
        check(turning.x(.5f)==475&&turning.y(.5f)==265,"Air travel must keep the center continuous");
        PetTurn changed=new PetTurn(475,265,400,970,turning.angle(500,1000),PetGravity.DOWN);
        check(changed.angle(0,1000)==-45&&changed.angle(500,1000)==-22.5f&&changed.angle(1000,1000)==0,
            "Changing the destination in flight must keep the current angle");
        PetTurn shortWay=new PetTurn(475,265,400,970,270,PetGravity.DOWN);
        check(shortWay.angle(500,1000)==315,"The turn must use the shorter path across a full circle");

        PetHomeMap.Box wall=new PetHomeMap.Box(PetHomeMap.FOLDER,120,0,205,240);
        PetBall side=new PetBall(40,100,450,0,1,420,330);
        for(int i=0;i<20&&side.contacts==0;i++)side.step(.02f,Collections.singletonList(wall));
        check(side.contacts==1&&side.vx<0&&side.x+side.radius<=wall.l,
            "A fast ball must rebound from the folder's real side");
        PetHomeMap.Box shelf=new PetHomeMap.Box(PetHomeMap.ICON,90,120,240,183);
        PetBall down=new PetBall(150,24,0,20,1,420,330);
        List<PetHomeMap.Box> boxes=Collections.singletonList(shelf);
        for(int i=0;i<225;i++)down.step(.018f,boxes);
        check(down.bounces>=2&&down.y+down.radius==shelf.t,"The ball must lose energy and rest on the icon");
        down.tap(-90,-220);
        down.step(.04f,boxes);
        check(down.y<110&&down.vy<0,"A timed foot contact sends the ball up again");
        System.out.println("Pet play: "+count+" gestures, continuous turns, ball contacts and recovery checked");
    }
}
