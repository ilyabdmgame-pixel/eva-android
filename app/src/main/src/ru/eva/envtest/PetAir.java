package ru.eva.envtest;

/** Registered airborne body in a 402×540 viewport, independently of the world trajectory. */
final class PetAir {
    static final int CONTACT=PetMotion.SPRING+5;
    static final int TOP=299,BOTTOM=531,ROWS=32,COLS=3;
    static final int BODY_COLS=12,BODY_ROWS=14;

    // Screen-right leg leads at takeoff. The trailing knee reacts later,
    // and the lead shoe extends before its partner as the floor approaches.
    private static final float[] PHASE={0,.16f,.38f,.57f,.76f,.90f,1};
    // Each drawing guide stores offsets of the knee, ankle and the shoe pitch.
    private static final float[][] LEAD={
        {0,0,0,0,0},{10,-9,-12,-22,7},{33,-30,-14,-66,20},
        {37,-36,-7,-76,26},{25,-19,13,-43,12},{12,-5,12,-11,-7},{0,0,0,0,0}};
    private static final float[][] TRAIL={
        {0,0,0,0,0},{5,-1,-3,-3,2},{17,-9,-14,-19,11},
        {25,-19,-24,-38,21},{20,-20,-20,-42,19},{9,-9,-10,-24,10},{0,0,0,0,0}};

    static final class Leg {
        float kneeX,kneeY,ankleX,ankleY,pitch;
        float hipX,restKneeX,restAnkleX;
    }

    // Interpolate tangent-continuous authored landmarks. Do not stop the
    // shins at every intermediate drawing. Endpoints have zero velocity.
    private static float channel(float[][] keys,int i,int col,float t){
        float width=PHASE[i+1]-PHASE[i],a=keys[i][col],b=keys[i+1][col];
        float before=i==0?0:(b-keys[i-1][col])*width/(PHASE[i+1]-PHASE[i-1]);
        float after=i+2==keys.length?0:(keys[i+2][col]-a)*width/(PHASE[i+2]-PHASE[i]);
        float t2=t*t,t3=t2*t;
        return (2*t3-3*t2+1)*a+(t3-2*t2+t)*before+(-2*t3+3*t2)*b+(t3-t2)*after;
    }

    static void sample(Leg leg,boolean lead,float phase,float amplitude){
        float u=PetMotion.clamp(phase,0,1);
        int i=0;
        while(i+2<PHASE.length&&u>PHASE[i+1])i++;
        float t=(u-PHASE[i])/(PHASE[i+1]-PHASE[i]);
        float[][] keys=lead?LEAD:TRAIL;
        leg.hipX=lead?222:180;
        leg.restKneeX=lead?225:176;
        leg.restAnkleX=lead?218:185;
        leg.kneeX=leg.restKneeX+amplitude*channel(keys,i,0,t);
        leg.kneeY=392+amplitude*channel(keys,i,1,t);
        leg.ankleX=leg.restAnkleX+amplitude*channel(keys,i,2,t);
        leg.ankleY=486+amplitude*channel(keys,i,3,t);
        leg.pitch=amplitude*channel(keys,i,4,t);
    }

    static void legVertex(Leg leg,float x,float y,float[] output,int at){
        float thigh=PetMotion.clamp((y-306)/86f,0,1);
        float shin=PetMotion.clamp((y-392)/94f,0,1);
        float kneeDX=leg.kneeX-leg.restKneeX,kneeDY=leg.kneeY-392;
        float ankleDX=leg.ankleX-leg.restAnkleX,ankleDY=leg.ankleY-486;
        float centerX=leg.hipX+(leg.restKneeX-leg.hipX)*thigh+(leg.restAnkleX-leg.restKneeX)*shin;
        float sx=kneeDX*thigh+(ankleDX-kneeDX)*shin;
        float sy=kneeDY*thigh+(ankleDY-kneeDY)*shin;
        // The inside fold occupies several strips of fabric. Mixing two
        // sharp bone normals in a single knee row can invert its triangles.
        float kneeMix=PetMotion.ease((y-355)/73f);
        if(y>355&&y<428){
            float upper=(y-306)/86f,lower=(y-392)/94f;
            sx=kneeDX*upper+(kneeDX+(ankleDX-kneeDX)*lower-kneeDX*upper)*kneeMix;
            sy=kneeDY*upper+(kneeDY+(ankleDY-kneeDY)*lower-kneeDY*upper)*kneeMix;
        }
        float hipBlend=PetMotion.ease((y-308)/42f);
        sx*=hipBlend;sy*=hipBlend;
        float thighAngle=(float)Math.atan2(-kneeDX,86+kneeDY);
        float shinAngle=(float)Math.atan2(-(ankleDX-kneeDX),94+ankleDY-kneeDY);
        float angle=.55f*(thighAngle+(shinAngle-thighAngle)*kneeMix)*hipBlend;
        float shoe=PetMotion.ease((y-447)/39f);
        angle+=(Math.toRadians(leg.pitch)-angle)*shoe;
        float cosine=(float)Math.cos(angle),sine=(float)Math.sin(angle);
        float across=x-centerX,below=Math.max(0,y-486);
        output[at]=x+sx+(cosine-1)*across-sine*below;
        output[at+1]=y+sy+sine*across+(cosine-1)*below;
    }

    static void bodyVertex(float x,float y,float weight,float[] out,int at){
        float low=PetMotion.ease((y-182)/155f);
        float left=PetMotion.ease((169-x)/22f),right=PetMotion.ease((x-234)/20f);
        float crown=PetMotion.ease((290-y)/150f);
        out[at]=x+weight*((3*right-3*left)*low-2*crown);
        out[at+1]=y-weight*(2*(left+right)*low+2*crown);
    }
    private PetAir(){}
}
